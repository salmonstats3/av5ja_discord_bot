import { CoralOAuth } from './utils/authorize';
import { config } from './utils/config';

CoralOAuth.refresh(config.session_token);
