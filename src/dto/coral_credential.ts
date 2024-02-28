import { JWT, Token } from './jwt.dto';

export class CoralCredential {
  readonly birthday: string;
  readonly bullet_token: string;
  readonly expires_in: Date;
  readonly country: string;
  readonly game_web_token: JWT<Token.GameWebToken>;
  readonly id: string;
  readonly language: string;
  readonly nickname: string;
  readonly revision: string;
  readonly session_token: JWT<Token.SessionToken>;
}
