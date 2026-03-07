// Message keys for consistent error and success messages
export const MESSAGE_KEYS = {
  // Email Subscription related messages
  EMAIL_SUBSCRIPTION: {
    // Success messages
    SUBSCRIBED: 'EMAIL_SUBSCRIPTION.SUBSCRIBED',
    EXAMPLE_EMAIL: 'EMAIL_SUBSCRIPTION.EXAMPLE_EMAIL',
    // Error messages
    INVALID_EMAIL_FORMAT: 'EMAIL_SUBSCRIPTION.INVALID_EMAIL_FORMAT',
  },

  // Common messages
  COMMON: {
    // Success messages
    SUCCESS: 'COMMON.SUCCESS',
    OPERATION_COMPLETED: 'COMMON.OPERATION_COMPLETED',
    LIST_FOUND: 'COMMON.LIST_FOUND',
    CREATED: 'COMMON.CREATED',
    UPDATED: 'COMMON.UPDATED',
    DELETED: 'COMMON.DELETED',
    // Error messages
    INTERNAL_ERROR: 'COMMON.INTERNAL_ERROR',
    VALIDATION_ERROR: 'COMMON.VALIDATION_ERROR',
    UNAUTHORIZED: 'COMMON.UNAUTHORIZED',
    FORBIDDEN: 'COMMON.FORBIDDEN',
    BAD_REQUEST: 'COMMON.BAD_REQUEST',
    NOT_FOUND: 'COMMON.NOT_FOUND',
    ALREADY_EXISTS: 'COMMON.ALREADY_EXISTS',
    CANNOT_BE_CREATED: 'COMMON.CANNOT_BE_CREATED',
    CANNOT_BE_UPDATED: 'COMMON.CANNOT_BE_UPDATED',
    CANNOT_BE_DELETED: 'COMMON.CANNOT_BE_DELETED',
    INVALID_DATA: 'COMMON.INVALID_DATA',
  },

  // Validation messages
  VALIDATION: {
    REQUIRED: 'VALIDATION.REQUIRED',
    INVALID_EMAIL: 'VALIDATION.INVALID_EMAIL',
    INVALID_PHONE: 'VALIDATION.INVALID_PHONE',
    INVALID_ROLE: 'VALIDATION.INVALID_ROLE',
    MIN_LENGTH: 'VALIDATION.MIN_LENGTH',
    MAX_LENGTH: 'VALIDATION.MAX_LENGTH',
  },

  // Filter and sort validation messages
  FILTER_AND_SORT: {
    ONLY_ONE_SORT_PARAM: 'FILTER_AND_SORT.ONLY_ONE_SORT_PARAM',
    INVALID_MIN_MAX_PRICE: 'FILTER_AND_SORT.INVALID_MIN_MAX_PRICE',
    MIN_PRICE_LESS_THAN_MAX: 'FILTER_AND_SORT.MIN_PRICE_LESS_THAN_MAX',
    INVALID_CATEGORY_ID: 'FILTER_AND_SORT.INVALID_CATEGORY_ID',
    INVALID_TAG_ID: 'FILTER_AND_SORT.INVALID_TAG_ID',
  },
} as const;

// Message templates with placeholders
export const MESSAGE_TEMPLATES = {
  //EMAIL SUBSCRIPTION MESSAGE KEYS
  [MESSAGE_KEYS.EMAIL_SUBSCRIPTION.SUBSCRIBED]: 'Đăng ký email thành công',
  [MESSAGE_KEYS.EMAIL_SUBSCRIPTION.INVALID_EMAIL_FORMAT]:
    'Định dạng email không hợp lệ',
  [MESSAGE_KEYS.EMAIL_SUBSCRIPTION.EXAMPLE_EMAIL]: 'user@example.com',

  //COMMON MESSAGE KEYS
  [MESSAGE_KEYS.COMMON.SUCCESS]: 'Thao tác hoàn thành thành công',
  [MESSAGE_KEYS.COMMON.OPERATION_COMPLETED]: 'Thao tác hoàn thành',
  [MESSAGE_KEYS.COMMON.LIST_FOUND]: 'Lấy danh sách thành công',
  [MESSAGE_KEYS.COMMON.CREATED]: 'Tạo mới thành công',
  [MESSAGE_KEYS.COMMON.UPDATED]: 'Cập nhật thành công',
  [MESSAGE_KEYS.COMMON.DELETED]: 'Xóa thành công',
  [MESSAGE_KEYS.COMMON.INTERNAL_ERROR]: 'Lỗi máy chủ ',
  [MESSAGE_KEYS.COMMON.VALIDATION_ERROR]: 'Lỗi xác thực dữ liệu',
  [MESSAGE_KEYS.COMMON.UNAUTHORIZED]: 'Truy cập không được phép',
  [MESSAGE_KEYS.COMMON.FORBIDDEN]: 'Truy cập bị cấm',
  [MESSAGE_KEYS.COMMON.BAD_REQUEST]: 'Yêu cầu không hợp lệ',
  [MESSAGE_KEYS.COMMON.NOT_FOUND]: 'Không tìm thấy dữ liệu',
  [MESSAGE_KEYS.COMMON.ALREADY_EXISTS]: 'Dữ liệu đã tồn tại',
  [MESSAGE_KEYS.COMMON.CANNOT_BE_CREATED]: 'Không thể tạo',
  [MESSAGE_KEYS.COMMON.CANNOT_BE_UPDATED]: 'Không thể cập nhật',
  [MESSAGE_KEYS.COMMON.CANNOT_BE_DELETED]: 'Không thể xóa',
  [MESSAGE_KEYS.COMMON.INVALID_DATA]: 'Dữ liệu không hợp lệ',

  // Validation messages
  [MESSAGE_KEYS.VALIDATION.REQUIRED]: '{field} là bắt buộc',
  [MESSAGE_KEYS.VALIDATION.INVALID_EMAIL]: 'Định dạng email không hợp lệ',
  [MESSAGE_KEYS.VALIDATION.INVALID_PHONE]:
    'Định dạng số điện thoại không hợp lệ',
  [MESSAGE_KEYS.VALIDATION.INVALID_ROLE]: ' Vai trò không hợp lệ',
  [MESSAGE_KEYS.VALIDATION.MIN_LENGTH]: '{field} phải có ít nhất {min} ký tự',
  [MESSAGE_KEYS.VALIDATION.MAX_LENGTH]:
    '{field} không được vượt quá {max} ký tự',

  // Filter and sort messages
  [MESSAGE_KEYS.FILTER_AND_SORT.ONLY_ONE_SORT_PARAM]:
    'Chỉ được phép sử dụng một trong hai tham số sắp xếp: sortAz hoặc sortPrice',
  [MESSAGE_KEYS.FILTER_AND_SORT.INVALID_MIN_MAX_PRICE]:
    'Giá trị minPrice và maxPrice phải là số hợp lệ',
  [MESSAGE_KEYS.FILTER_AND_SORT.MIN_PRICE_LESS_THAN_MAX]:
    'Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa',
  [MESSAGE_KEYS.FILTER_AND_SORT.INVALID_CATEGORY_ID]:
    'ID danh mục không hợp lệ',
  [MESSAGE_KEYS.FILTER_AND_SORT.INVALID_TAG_ID]: 'ID thẻ không hợp lệ',
};

// Helper function to format messages with placeholders
export function formatMessage(
  key: string,
  params?: Record<string, any>,
): string {
  let message = MESSAGE_TEMPLATES[key as keyof typeof MESSAGE_TEMPLATES] || key;

  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(`{${param}}`, String(value));
    });
  }

  return message;
}