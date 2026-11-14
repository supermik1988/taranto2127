export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export class TurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnError';
  }
}
