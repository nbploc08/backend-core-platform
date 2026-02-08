// import { Controller, Get, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
// import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';
// import { UsersService } from '../users/users.service';
// import { ErrorCodes, ServiceError } from '@common/core';

// @Controller('internal')
// @UseGuards(InternalJwtAuthGuard)
// export class InternalController {
//   constructor(private readonly usersService: UsersService) {}

//   @Get('profile')
//   @HttpCode(HttpStatus.OK)
//   async getProfile(@Request() req: { user: { userId: string } }) {
//     const userId = req.user?.userId;
//     if (!userId) {
//       throw new ServiceError({
//         code: ErrorCodes.UNAUTHORIZED,
//         statusCode: 401,
//         message: 'Missing userId in internal token',
//       });
//     }
//     const profile = await this.usersService.getProfileById(userId);
//     if (!profile) {
//       throw new ServiceError({
//         code: ErrorCodes.NOT_FOUND,
//         statusCode: 404,
//         message: 'User not found',
//       });
//     }
//     return profile;
//   }
// }
