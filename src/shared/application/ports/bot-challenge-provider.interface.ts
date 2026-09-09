export const BOT_CHALLENGE_PROVIDER = Symbol('BOT_CHALLENGE_PROVIDER');

export interface BotChallengeInput {
  token: string;
  expectedAction: string;
  remoteIp?: string;
}

export interface BotChallengeProvider {
  verify(input: BotChallengeInput): Promise<boolean>;
}
