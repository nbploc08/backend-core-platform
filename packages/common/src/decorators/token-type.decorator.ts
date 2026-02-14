import { SetMetadata } from '@nestjs/common';

export const TOKEN_TYPE_KEY = 'tokenType';

export type AllowedTokenType = 'user' | 'internal';

export const UserOnly = () => SetMetadata(TOKEN_TYPE_KEY, 'user');
export const InternalOnly = () => SetMetadata(TOKEN_TYPE_KEY, 'internal');
