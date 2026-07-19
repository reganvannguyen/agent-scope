import { isRecord } from './ProtocolTypes';
import type { RpcClient } from './RpcClient';

export interface AccountState {
  signedIn: boolean;
  type?: 'chatgpt' | 'apiKey' | 'amazonBedrock';
  label?: string;
  planType?: string;
  requiresOpenaiAuth: boolean;
}
type AccountType = 'chatgpt' | 'apiKey' | 'amazonBedrock';

export interface LoginStart {
  loginId: string;
  authUrl: string;
}

export class AccountService {
  public constructor(private readonly client: RpcClient) {}

  public async read(): Promise<AccountState> {
    const raw = await this.client.request<unknown>('account/read', { refreshToken: false });
    if (!isRecord(raw) || typeof raw.requiresOpenaiAuth !== 'boolean') throw new Error('Invalid account/read response');
    const account = raw.account;
    if (account === null) return { signedIn: false, requiresOpenaiAuth: raw.requiresOpenaiAuth };
    if (!isRecord(account) || !isAccountType(account.type)) throw new Error('Invalid account data');
    const state: AccountState = { signedIn: true, type: account.type, requiresOpenaiAuth: raw.requiresOpenaiAuth };
    if (account.type === 'chatgpt') {
      if (typeof account.email === 'string') state.label = sanitizeAccountLabel(account.email);
      if (typeof account.planType === 'string') state.planType = account.planType;
    } else if (account.type === 'apiKey') {
      state.label = 'API key';
    } else {
      state.label = 'Amazon Bedrock';
    }
    return state;
  }

  public async startChatGptLogin(): Promise<LoginStart> {
    const raw = await this.client.request<unknown>('account/login/start', {
      type: 'chatgpt', codexStreamlinedLogin: true, useHostedLoginSuccessPage: true
    });
    if (!isRecord(raw) || raw.type !== 'chatgpt' || typeof raw.loginId !== 'string' || typeof raw.authUrl !== 'string') {
      throw new Error('Invalid ChatGPT login response');
    }
    const url = new URL(raw.authUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported login URL');
    return { loginId: raw.loginId, authUrl: url.toString() };
  }
}

function isAccountType(value: unknown): value is AccountType {
  return value === 'chatgpt' || value === 'apiKey' || value === 'amazonBedrock';
}

function sanitizeAccountLabel(email: string): string {
  const [name, domain] = email.split('@');
  if (name === undefined || domain === undefined || name.length < 2) return 'ChatGPT account';
  return `${name[0] ?? ''}…@${domain}`;
}
