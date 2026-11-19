// Formula Racing 3D — Autonomous English Voice Race Commentary Engine
// Uses the browser Web Speech API (window.speechSynthesis) with en-GB British English voice selection.
// Zero external API dependencies, zero cloud subscriptions, zero audio downloads.
// Fully SSR-safe and resilient to headless/unsupported environments.

export type CommentaryCategory =
  | "START"
  | "OVERTAKE"
  | "POSITION"
  | "LAP"
  | "SECTOR"
  | "FASTEST_LAP"
  | "DRS"
  | "WARNING"
  | "LIMITS"
  | "FINISH"
  | "COCKPIT";

export interface CommentaryMessage {
  id: string;
  text: string;
  category: CommentaryCategory;
  priority: number; // Higher number = higher priority (1 to 5)
  timestamp: number;
}

export interface CommentaryState {
  latestMessage: CommentaryMessage | null;
  history: CommentaryMessage[];
  isEnabled: boolean;
  voiceName: string;
  isSpeaking: boolean;
}

export class RaceCommentary {
  private isEnabled: boolean = true;
  private volume: number = 0.85;
  private speechSynth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private queue: CommentaryMessage[] = [];
  private history: CommentaryMessage[] = [];
  private latestMessage: CommentaryMessage | null = null;
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;

  // Event cooldown timers (timestamp in ms)
  private lastSpokenTime: number = 0;
  private lastCategoryTime: Record<string, number> = {};

  // Tracked states for transition detection
  private prevCountdown: number | null = null;
  private prevSector: number = 1;
  private prevLap: number = 1;
  private prevPosition: number = 6;
  private prevOffTrack: boolean = false;
  private prevLockup: boolean = false;
  private prevDrsAvailable: boolean = false;
  private prevDrsActive: boolean = false;
  private prevFinished: boolean = false;
  private bestLapTime: number = Infinity;

  // Callbacks for HUD reactivity
  public onUpdate?: (state: CommentaryState) => void;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.speechSynth = window.speechSynthesis;
      this.initVoice();
      if (this.speechSynth.onvoiceschanged !== undefined) {
        this.speechSynth.onvoiceschanged = () => this.initVoice();
      }
    }
  }

  /**
   * Selects an authentic British English voice if available,
   * falling back to other English voices or the browser default.
   */
  private initVoice(): void {
    if (!this.speechSynth) return;
    try {
      const voices = this.speechSynth.getVoices();
      if (!voices || voices.length === 0) return;

      // 1. Prefer UK English (en-GB)
      let match = voices.find(
        (v) =>
          (v.lang.includes("en-GB") || v.lang.includes("en_GB")) &&
          !v.name.toLowerCase().includes("whisper")
      );

      // 2. Fall back to name-based UK cues
      if (!match) {
        match = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("United Kingdom") ||
              v.name.includes("UK") ||
              v.name.includes("British") ||
              v.name.includes("George") ||
              v.name.includes("Oliver") ||
              v.name.includes("Daniel") ||
              v.name.includes("Serena"))
        );
      }

      // 3. Fall back to any English voice
      if (!match) {
        match = voices.find((v) => v.lang.startsWith("en"));
      }

      // 4. Default voice
      this.selectedVoice = match || voices[0] || null;
      this.notify();
    } catch {
      // SpeechSynthesis voices query ignored
    }
  }

  /**
   * Process game telemetry and session states to trigger timely commentary.
   */
  public update(
    countdown: number | null,
    playerLap: number,
    totalLaps: number,
    currentSector: 1 | 2 | 3,
    playerPosition: number,
    offTrack: boolean,
    isLockup: boolean,
    drsAvailable: boolean,
    drsActive: boolean,
    lapTime: number,
    isFinished: boolean,
    speedMs: number
  ): void {
    if (this.isPaused) return;

    const now = Date.now();

    // 1. Race Start
    if (this.prevCountdown !== null && countdown === 0 && this.prevCountdown > 0) {
      const startPhrases = [
        "And we're racing! Fantastic launch from the grid!",
        "Lights out and away we go! The race is underway!",
        "Great start from the grid! Let's see who claims the apex into turn one."
      ];
      this.say(startPhrases[Math.floor(Math.random() * startPhrases.length)], "START", 5);
    }
    this.prevCountdown = countdown;

    // Do not comment further if still in countdown or finished
    if (countdown !== null && countdown > 0) return;

    // 2. Race Finish
    if (isFinished && !this.prevFinished) {
      this.clearQueue();
      if (playerPosition === 1) {
        this.say(
          "Here comes the chequered flag! What a stunning victory! Sensational driving!",
          "FINISH",
          5
        );
      } else if (playerPosition <= 3) {
        this.say(
          `That's the end of the race! A brilliant podium finish in P${playerPosition}! Excellent driving!`,
          "FINISH",
          5
        );
      } else {
        this.say(
          `That's the chequered flag! You bring the car home in P${playerPosition}. Strong effort today.`,
          "FINISH",
          5
        );
      }
      this.prevFinished = true;
      return;
    }
    this.prevFinished = isFinished;

    if (isFinished) return;

    // 3. Verified Race Position Changes
    if (playerPosition !== this.prevPosition && this.prevPosition > 0) {
      if (playerPosition < this.prevPosition) {
        // Gained position (Overtake!)
        const phrases = [
          `You've moved up to P${playerPosition}! Magnificent overtaking maneuver!`,
          `Sensational move! P${playerPosition} is yours, keep pushing!`,
          `Clean overtake! Up into P${playerPosition} now!`
        ];
        this.say(phrases[Math.floor(Math.random() * phrases.length)], "OVERTAKE", 4);
      } else if (playerPosition > this.prevPosition) {
        // Lost position
        this.say(
          `You've lost a position. Down to P${playerPosition}. Settle in and plan the counterattack.`,
          "POSITION",
          3
        );
      }
      this.prevPosition = playerPosition;
    }

    // 4. Lap Progression & Final Lap
    if (playerLap > this.prevLap && this.prevLap >= 1) {
      if (playerLap === totalLaps) {
        this.say("Final lap! Give it everything you've got!", "LAP", 5);
      } else {
        // Check if previous lap was personal fastest
        if (lapTime > 20 && lapTime < this.bestLapTime) {
          this.bestLapTime = lapTime;
          this.say(
            `You've started lap ${playerLap}. That was your fastest lap of the session!`,
            "FASTEST_LAP",
            4
          );
        } else {
          this.say(
            `Across the line, starting lap ${playerLap} of ${totalLaps}.`,
            "LAP",
            3
          );
        }
      }
      this.prevLap = playerLap;
    }

    // 5. Sector Splits
    if (currentSector !== this.prevSector) {
      if (currentSector === 2 && this.prevSector === 1) {
        this.say("Sector one completed. Clean through the opening complex.", "SECTOR", 2);
      } else if (currentSector === 3 && this.prevSector === 2) {
        this.say("Good pace through sector two, heading into the final sector.", "SECTOR", 2);
      }
      this.prevSector = currentSector;
    }

    // 6. DRS Availability & Activation
    if (drsAvailable && !this.prevDrsAvailable && !drsActive) {
      this.say("DRS is now available.", "DRS", 2);
    }
    this.prevDrsAvailable = drsAvailable;

    if (drsActive && !this.prevDrsActive) {
      this.say("DRS activated. Take advantage on the straight.", "DRS", 2);
    }
    this.prevDrsActive = drsActive;

    // 7. Track Limits & Off-Track Warnings
    if (offTrack && !this.prevOffTrack) {
      this.say("Warning! You're off the track. Mind the track limits!", "WARNING", 4);
    } else if (!offTrack && this.prevOffTrack) {
      this.say("You're back on the racing surface. Re-gather your rhythm.", "LIMITS", 3);
    }
    this.prevOffTrack = offTrack;

    // 8. Tyre Lockup Warning
    if (isLockup && !this.prevLockup && speedMs > 18) {
      this.say("Careful, front tyre lock-up detected into the braking zone.", "WARNING", 3);
    }
    this.prevLockup = isLockup;

    // Process queued speech
    this.processQueue(now);
  }

  /**
   * Queue a commentary message with priority and cooldown validation.
   */
  public say(text: string, category: CommentaryCategory, priority: number = 2): void {
    const now = Date.now();

    // Specific category cooldowns
    const cooldowns: Record<CommentaryCategory, number> = {
      START: 0,
      FINISH: 0,
      OVERTAKE: 5000,
      POSITION: 6000,
      LAP: 8000,
      FASTEST_LAP: 10000,
      SECTOR: 6000,
      DRS: 14000,
      WARNING: 7000,
      LIMITS: 6000,
      COCKPIT: 10000
    };

    const lastCat = this.lastCategoryTime[category] || 0;
    if (now - lastCat < cooldowns[category]) {
      return; // Suppress repetitive category bursts
    }

    const message: CommentaryMessage = {
      id: `comm_${now}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      category,
      priority,
      timestamp: now
    };

    this.lastCategoryTime[category] = now;

    // If critical priority (e.g. Finish or Start), clear lower priority queue
    if (priority >= 5) {
      this.queue = [message];
      if (this.speechSynth && this.speechSynth.speaking) {
        this.speechSynth.cancel();
        this.isSpeaking = false;
      }
    } else {
      // Prevent queue bloat (keep max 3 items)
      if (this.queue.length >= 3) {
        this.queue.sort((a, b) => b.priority - a.priority);
        this.queue.pop();
      }
      this.queue.push(message);
      this.queue.sort((a, b) => b.priority - a.priority);
    }

    // Always update caption immediately for broadcast HUD
    this.latestMessage = message;
    this.history.unshift(message);
    if (this.history.length > 8) this.history.pop();
    this.notify();

    this.processQueue(now);
  }

  /**
   * Dispatch the next speech utterance through the Web Speech API.
   */
  private processQueue(now: number): void {
    if (this.isSpeaking || this.isPaused || this.queue.length === 0) return;
    if (!this.isEnabled) {
      // When muted/disabled, drain queue silently while maintaining captions
      this.queue.shift();
      return;
    }

    // Ensure at least 1.4 seconds between spoken sentences
    if (now - this.lastSpokenTime < 1400) return;

    if (!this.speechSynth) {
      this.queue.shift();
      return;
    }

    const nextMsg = this.queue.shift();
    if (!nextMsg) return;

    try {
      if (this.speechSynth.speaking) {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(nextMsg.text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang;
      } else {
        utterance.lang = "en-GB";
      }

      utterance.rate = 1.05; // Slightly brisk broadcast cadence
      utterance.pitch = 1.0;
      utterance.volume = this.volume;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.notify();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.lastSpokenTime = Date.now();
        this.notify();
        // Trigger next in queue after short pause
        setTimeout(() => this.processQueue(Date.now()), 250);
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.lastSpokenTime = Date.now();
        this.notify();
      };

      this.speechSynth.speak(utterance);
    } catch {
      this.isSpeaking = false;
    }
  }

  public toggleMute(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled && this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
      this.isSpeaking = false;
    }
    this.notify();
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!this.isEnabled && this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
      this.isSpeaking = false;
    }
    this.notify();
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public pause(): void {
    this.isPaused = true;
    if (this.speechSynth) {
      try {
        this.speechSynth.pause();
      } catch {
        this.speechSynth.cancel();
      }
    }
    this.isSpeaking = false;
    this.notify();
  }

  public resume(): void {
    this.isPaused = false;
    if (this.speechSynth && this.speechSynth.paused) {
      try {
        this.speechSynth.resume();
      } catch {
        // Fallback
      }
    }
    this.notify();
  }

  public clearQueue(): void {
    this.queue = [];
    if (this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
    }
    this.isSpeaking = false;
    this.notify();
  }

  public getState(): CommentaryState {
    return {
      latestMessage: this.latestMessage,
      history: this.history,
      isEnabled: this.isEnabled,
      voiceName: this.selectedVoice ? this.selectedVoice.name : "Default English",
      isSpeaking: this.isSpeaking
    };
  }

  private notify(): void {
    if (this.onUpdate) {
      this.onUpdate(this.getState());
    }
  }

  public dispose(): void {
    this.clearQueue();
    if (this.speechSynth) {
      this.speechSynth.cancel();
    }
    this.onUpdate = undefined;
  }
}

export const raceCommentary = new RaceCommentary();
