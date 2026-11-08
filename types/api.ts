// =============================================================
// Generic API Response - khớp với com.mkwang.backend.common.dto.ApiResponse<T>
// =============================================================

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string; // ISO 8601 LocalDateTime from Java (yyyy-MM-dd'T'HH:mm:ss)
}

// =============================================================
// Base Entity Fields - khớp với com.mkwang.backend.common.base.BaseEntity
// =============================================================

export interface BaseEntity {
  createdAt: string;
  updatedAt: string;
}

// =============================================================
// Pagination - khớp với backend custom pagination format
// Page index = 1-based (khác Spring Data 0-based)
// =============================================================

/**
 * Backend trả pagination theo format tự định nghĩa (KHÔNG dùng Spring Data Page<T>).
 * Sử dụng 1-indexed page.
 *
 * Ví dụ: GET /requests?page=1&limit=20
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;       // indexing varies by endpoint — check the specific API before relying on it
  size: number;
  totalPages: number;
}

/** Params phân trang gửi lên backend */
export interface PaginationParams {
  page?: number;     // 1-indexed, default 1
  limit?: number;    // default 20
}

/** Params phân trang + search chung */
export interface SearchPaginationParams extends PaginationParams {
  search?: string;
}

/** Date range filter params */
export interface DateRangeParams {
  from?: string;     // YYYY-MM-DD
  to?: string;       // YYYY-MM-DD
}
