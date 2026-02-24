import { Injectable } from '@nestjs/common';
import { logger } from '@common/core';

/**
 * @description
 * test
 * Socket Registry - Quản lý danh sách connections
 *
 * Mục đích: Biết user nào đang online với những socket nào
 * Ví dụ: User A mở 3 tabs → có 3 socket connections
 *
 * Cấu trúc dữ liệu:
 * userSockets = Map {
 *   'user-id-123' => Set { 'socket-abc', 'socket-xyz' },
 *   'user-id-456' => Set { 'socket-def' }
 * }
 *
 * socketToUser = Map {
 *   'socket-abc' => 'user-id-123',
 *   'socket-xyz' => 'user-id-123',
 *   'socket-def' => 'user-id-456'
 * }
 */
@Injectable()
export class SocketRegistryService {
  // Map: userId → Set of socketIds (1 user có thể có nhiều sockets/tabs)
  private readonly userSockets = new Map<string, Set<string>>();

  // Map: socketId → userId (để khi disconnect biết socket thuộc user nào)
  private readonly socketToUser = new Map<string, string>();

  /**
   * Đăng ký socket khi user kết nối và xác thực thành công
   * @param userId - ID của user
   * @param socketId - ID của socket connection
   */
  register(userId: string, socketId: string): void {
    // Lấy danh sách sockets hiện tại của user (hoặc tạo mới nếu chưa có)
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }

    // Thêm socketId vào danh sách của user
    this.userSockets.get(userId)!.add(socketId);

    // Lưu mapping ngược: socket → user
    this.socketToUser.set(socketId, userId);

    logger.info(
      { userId, socketId, totalSockets: this.userSockets.get(userId)!.size },
      'Socket registered',
    );
  }

  /**
   * Hủy đăng ký socket khi disconnect
   * @param socketId - ID của socket cần xóa
   */
  unregister(socketId: string): void {
    // Tìm userId từ socketId
    const userId = this.socketToUser.get(socketId);

    if (!userId) {
      // Socket không tồn tại trong registry (chưa auth hoặc đã bị xóa)
      return;
    }

    // Xóa socket khỏi danh sách của user
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);

      // Nếu user không còn socket nào, xóa luôn entry của user
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Xóa mapping socket → user
    this.socketToUser.delete(socketId);

    logger.info({ userId, socketId }, 'Socket unregistered');
  }

  /**
   * Lấy tất cả socketIds của một user
   * Dùng khi cần gửi message đến tất cả tabs của user
   * @param userId - ID của user
   * @returns Set of socketIds hoặc empty Set
   */
  getSocketsByUser(userId: string): Set<string> {
    return this.userSockets.get(userId) || new Set();
  }

  /**
   * Lấy userId từ socketId
   * @param socketId - ID của socket
   * @returns userId hoặc undefined
   */
  getUserBySocket(socketId: string): string | undefined {
    return this.socketToUser.get(socketId);
  }

  /**
   * Kiểm tra user có đang online không
   * @param userId - ID của user
   * @returns true nếu user có ít nhất 1 socket đang kết nối
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Đếm số users đang online
   */
  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Đếm tổng số connections
   */
  getTotalConnectionsCount(): number {
    return this.socketToUser.size;
  }
}
