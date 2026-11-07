"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { ApiError, api } from "@/lib/api-client";
import { extractReceipt, getAiStatus, suggestReceiptCategory } from "@/lib/api/ai";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/contexts/toast-context";
import { CurrencyInput } from "@/components/ui/currency-input";
import { AiFilledBadge } from "@/components/request/ai-filled-badge";
import { ReceiptScanStatus, type ReceiptScanState } from "@/components/request/receipt-scan-status";
import { ReceiptPreviewModal } from "@/components/request/receipt-preview-modal";
import { useAuth } from "@/contexts/auth-context";
import {
  AdvanceBalanceItem,
  AiCategory,
  AiStatusResponse,
  CreateRequestBody,
  ExpenseCategoryResponse,
  FileStorageRequest,
  PaginatedResponse,
  ProjectListItem,
  ProjectPhasesResponse,
  RequestDetailResponse,
  RequestType,
  RoleName,
} from "@/types";

interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  /** Trạng thái AI đọc chứng từ; undefined = chưa đọc (AI tắt hoặc loại yêu cầu không dùng AI) */
  scan?: ReceiptScanState;
}

/** Các ô AI có thể tự điền. Ô nằm trong tập này nghĩa là giá trị hiện tại do AI điền. */
type AiField = "amount" | "expenseDate" | "title" | "description" | "categoryId";

const AI_DESCRIPTION_MAX = 1000;

interface CategoryOption {
  id: number;
  name: string;
}


interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  original_filename: string;
  bytes: number;
}


const REQUEST_TYPE_CONFIG = [
  {
    type: RequestType.ADVANCE,
    label: "Tạm ứng",
    sub: "Ứng tiền trước cho hoạt động chi tiêu",
    cardSelected: "border-blue-500 bg-blue-50",
    cardHover: "hover:border-blue-300",
    iconSelected: "bg-blue-500 text-white",
    iconDefault: "bg-blue-100 text-blue-600",
    labelSelected: "text-blue-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    type: RequestType.EXPENSE,
    label: "Hoàn chi nhân viên",
    sub: "Đề nghị hoàn tiền cho khoản đã tự chi, kèm chứng từ",
    cardSelected: "border-violet-500 bg-violet-50",
    cardHover: "hover:border-violet-300",
    iconSelected: "bg-violet-500 text-white",
    iconDefault: "bg-violet-100 text-violet-600",
    labelSelected: "text-violet-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    type: RequestType.REIMBURSE,
    label: "Quyết toán tạm ứng",
    sub: "Nộp chứng từ cho khoản đã chi bằng tiền tạm ứng",
    cardSelected: "border-teal-500 bg-teal-50",
    cardHover: "hover:border-teal-300",
    iconSelected: "bg-teal-500 text-white",
    iconDefault: "bg-teal-100 text-teal-600",
    labelSelected: "text-teal-700",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
] as const;

const ROLE_CREATE_ACTIONS: Partial<
  Record<RoleName, { title: string; description: string; href: string; action: string }>
> = {
  [RoleName.TEAM_LEADER]: {
    title: "Xin cấp vốn dự án",
    description: "Trưởng nhóm tạo yêu cầu cấp vốn tại màn hình chi tiết dự án mình phụ trách.",
    href: "/team-leader/projects",
    action: "Chọn dự án để xin cấp vốn",
  },
  [RoleName.MANAGER]: {
    title: "Xin cấp vốn phòng ban",
    description: "Manager tạo yêu cầu cấp ngân sách từ dashboard quản lý phòng ban.",
    href: "/dashboard",
    action: "Về dashboard Manager",
  },
};


function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

async function uploadAttachments(files: UploadFileItem[]): Promise<FileStorageRequest[]> {
  if (files.length === 0) return [];

  const uploadedFiles: FileStorageRequest[] = [];

  for (const item of files) {
    const signatureRes = await api.get<UploadSignatureResponse>(
      "/api/v1/uploads/signature?folder=REQUEST"
    );

    const signature = signatureRes.data;
    const formData = new FormData();
    formData.append("file", item.file);

    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("folder", signature.folder);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!cloudinaryRes.ok) {
      let detail = "";

      try {
        const errBody = (await cloudinaryRes.json()) as { error?: { message?: string } };
        if (errBody.error?.message) detail = `: ${errBody.error.message}`;
      } catch {
        // ignore Cloudinary error body parse failure
      }

      throw new Error(
        `Tải tệp ${item.file.name} thất bại${detail} (HTTP ${cloudinaryRes.status}). Vui lòng thử lại.`
      );
    }

    const uploaded = (await cloudinaryRes.json()) as CloudinaryUploadResponse;

    uploadedFiles.push({
      fileName: item.file.name || `${uploaded.original_filename}.${uploaded.format ?? "bin"}`,
      cloudinaryPublicId: uploaded.public_id,
      url: uploaded.secure_url,
      fileType: item.file.type || `${uploaded.resource_type}/${uploaded.format ?? "octet-stream"}`,
      size: item.file.size || uploaded.bytes,
      // Liên kết bản AI đã đọc → backend đối chiếu số tiền + phát hiện hoá đơn dùng lại
      extractionId:
        item.scan?.state === "done" && !item.scan.ignored ? item.scan.result.extractionId : undefined,
    });
  }

  return uploadedFiles;
}

export default function NewRequestPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const currentRole = user?.role as RoleName | undefined;
  const canCreatePersonalRequest = currentRole === RoleName.EMPLOYEE;
  const roleCreateAction = currentRole ? ROLE_CREATE_ACTIONS[currentRole] : undefined;

  const [form, setForm] = useState<Partial<CreateRequestBody>>({
    type: RequestType.ADVANCE,
    amount: undefined,
    projectId: undefined,
    phaseId: undefined,
    categoryId: undefined,
    description: "",
  });

  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [phases, setPhases] = useState<ProjectPhasesResponse | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  const [advanceOptions, setAdvanceOptions] = useState<AdvanceBalanceItem[]>([]);
  const [advanceBalanceId, setAdvanceBalanceId] = useState<number | undefined>(undefined);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [files, setFiles] = useState<UploadFileItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const isReimburseType = form.type === RequestType.REIMBURSE;
  const isProjectBasedType = useMemo(
    () =>
      form.type === RequestType.ADVANCE ||
      form.type === RequestType.EXPENSE ||
      form.type === RequestType.REIMBURSE,
    [form.type]
  );

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      if (!canCreatePersonalRequest) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const projectsRes = await api.get<ProjectListItem[] | PaginatedResponse<ProjectListItem>>(
          "/api/v1/projects"
        );

        if (cancelled) return;
        const projectList = Array.isArray(projectsRes.data)
          ? projectsRes.data
          : (projectsRes.data as PaginatedResponse<ProjectListItem>).items ?? [];
        setProjects(projectList);
      } catch (err) {
        if (cancelled) return;
        setProjects([]);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách dự án.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [canCreatePersonalRequest, toast]);

  useEffect(() => {
    const projectId = form.projectId;

    setForm((prev) => ({
      ...prev,
      phaseId: undefined,
      categoryId: undefined,
    }));
    setCategoryOptions([]);

    if (!projectId || !isProjectBasedType) {
      setPhases(null);
      return;
    }

    let cancelled = false;

    const loadPhases = async () => {
      setLoadingPhases(true);

      try {
        // Quyết toán dùng phase của khoản tạm ứng gốc, phase đó có thể đã đóng → không lọc ACTIVE
        const statusQuery = isReimburseType ? "" : "?status=ACTIVE";
        const phasesRes = await api.get<ProjectPhasesResponse>(
          `/api/v1/projects/${projectId}/phases${statusQuery}`
        );

        if (cancelled) return;
        setPhases(phasesRes.data);
      } catch (err) {
        if (cancelled) return;

        setPhases(null);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải phase dự án.");
        }
      } finally {
        if (!cancelled) setLoadingPhases(false);
      }
    };

    void loadPhases();

    return () => {
      cancelled = true;
    };
  }, [form.projectId, projects, isProjectBasedType, isReimburseType, toast]);

  useEffect(() => {
    const phaseId = form.phaseId;

    setForm((prev) => ({
      ...prev,
      categoryId: undefined,
    }));

    if (!phaseId || !isProjectBasedType) {
      setCategoryOptions([]);
      return;
    }

    let cancelled = false;

    const loadCategories = async () => {
      setLoadingCategories(true);

      try {
        const res = await api.get<{ items: ExpenseCategoryResponse[] } | ExpenseCategoryResponse[]>(
          `/api/v1/projects/${phaseId}`
        );

        if (cancelled) return;

        const categories = Array.isArray(res.data) ? res.data : res.data.items;
        setCategoryOptions(categories.map((category) => ({ id: category.id, name: category.name })));
      } catch (err) {
        if (cancelled) return;

        setCategoryOptions([]);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách hạng mục chi phí.");
        }
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, [form.phaseId, isProjectBasedType, toast]);

  useEffect(() => {
    if (!isReimburseType) {
      setAdvanceOptions([]);
      setAdvanceBalanceId(undefined);
      return;
    }

    let cancelled = false;

    const loadAdvanceBalances = async () => {
      setLoadingAdvances(true);

      try {
        const res = await api.get<AdvanceBalanceItem[]>("/api/v1/requests/my-advance-balances");

        if (cancelled) return;

        setAdvanceOptions(res.data);
      } catch (err) {
        if (cancelled) return;

        setAdvanceOptions([]);

        if (err instanceof ApiError) {
          toast.error(err.apiMessage);
        } else {
          toast.error("Không thể tải danh sách tạm ứng.");
        }
      } finally {
        if (!cancelled) setLoadingAdvances(false);
      }
    };

    void loadAdvanceBalances();

    return () => {
      cancelled = true;
    };
  }, [isReimburseType, toast]);

  // Thu hồi object URL khi rời trang. Không chạy theo mỗi lần `files` đổi: trạng thái AI
  // cập nhật `files` liên tục, làm vậy sẽ thu hồi URL của ảnh vẫn đang hiển thị.
  // Xoá từng file thì removeFile tự thu hồi URL của file đó.
  const filesRef = useRef<UploadFileItem[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const previewItem = files.find((f) => f.id === previewFileId) ?? null;
  const closePreview = useCallback(() => setPreviewFileId(null), []);

  // ── AI đọc chứng từ ─────────────────────────────────────────
  // Nguyên tắc: AI chỉ điền ô đang trống hoặc ô mà chính AI đã điền trước đó;
  // user sửa ô nào thì ô đó thuộc về user, AI không đụng vào nữa.

  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [aiFilled, setAiFilled] = useState<Set<AiField>>(() => new Set());
  const aiFilledRef = useRef<Set<AiField>>(new Set());
  /** Hạng mục AI chọn cho một phase cụ thể (chỉ dùng cho Hoàn chi nhân viên) */
  const [aiCategory, setAiCategory] = useState<(AiCategory & { phaseId: number }) | null>(null);
  const suggestedKeysRef = useRef<Set<string>>(new Set());
  const scanStartedRef = useRef<Set<string>>(new Set());

  // Quyết toán tạm ứng: dự án / phase / hạng mục lấy theo khoản tạm ứng gốc
  const [linkedToAdvance, setLinkedToAdvance] = useState(false);
  const advancePrefillRef = useRef<{ phaseId?: number | null; categoryId?: number | null } | null>(null);

  // Giá trị mới nhất của form, đọc trong effect mà không phải đưa vào dependency
  const latestRef = useRef({ form, title, expenseDate });
  useEffect(() => {
    latestRef.current = { form, title, expenseDate };
  });

  const aiEnabled = !!aiStatus?.enabled;
  const scanEligible =
    aiEnabled && (form.type === RequestType.EXPENSE || form.type === RequestType.REIMBURSE);
  const linkedLocked = isReimburseType && linkedToAdvance;
  const selectedAdvance = advanceOptions.find((a) => a.id === advanceBalanceId);

  const markAiFilled = useCallback((fields: AiField[], filled: boolean) => {
    if (fields.length === 0) return;
    const next = new Set(aiFilledRef.current);
    fields.forEach((f) => (filled ? next.add(f) : next.delete(f)));
    aiFilledRef.current = next;
    setAiFilled(next);
  }, []);

  useEffect(() => {
    if (!canCreatePersonalRequest) return;
    let cancelled = false;
    getAiStatus()
      .then((res) => {
        if (!cancelled) setAiStatus(res.data);
      })
      .catch(() => {
        if (!cancelled) setAiStatus(null); // AI không khả dụng → form nhập tay như cũ
      });
    return () => {
      cancelled = true;
    };
  }, [canCreatePersonalRequest]);

  const scanFile = useCallback(async (id: string, file: File) => {
    const current = latestRef.current.form;
    // Chỉ Hoàn chi nhân viên mới cần AI chọn hạng mục; Quyết toán lấy hạng mục theo tạm ứng
    const phaseId = current.type === RequestType.EXPENSE ? current.phaseId : undefined;
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, scan: { state: "scanning" } } : f)));

    try {
      const res = await extractReceipt(file, phaseId);
      const result = res.data;
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, scan: { state: "done", result, ignored: false } } : f))
      );
      if (phaseId) {
        suggestedKeysRef.current.add(`${result.extractionId}:${phaseId}`);
        if (result.suggestion.category) setAiCategory({ ...result.suggestion.category, phaseId });
      }
      if (!result.cached) {
        setAiStatus((s) => (s ? { ...s, remainingToday: Math.max(0, s.remainingToday - 1) } : s));
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.apiMessage : "Không đọc được chứng từ, vui lòng nhập tay.";
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, scan: { state: "error", message } } : f))
      );
    }
  }, []);

  // Tự đọc mọi file chưa đọc khi AI dùng được cho loại yêu cầu hiện tại
  useEffect(() => {
    if (!scanEligible) return;
    files.forEach((item) => {
      if (item.scan || scanStartedRef.current.has(item.id)) return;
      scanStartedRef.current.add(item.id);
      void scanFile(item.id, item.file);
    });
  }, [files, scanEligible, scanFile]);

  const scanResults = useMemo(
    () =>
      files.flatMap((f) =>
        f.scan?.state === "done" && !f.scan.ignored ? [f.scan.result] : []
      ),
    [files]
  );
  const scanKey = scanResults.map((r) => r.extractionId).join(",");

  // Gộp kết quả các chứng từ rồi điền vào form
  useEffect(() => {
    if (!scanEligible) return;
    const { form: f, title: t, expenseDate: d } = latestRef.current;
    const owned = aiFilledRef.current;
    const canFill = (field: AiField, isEmpty: boolean) => isEmpty || owned.has(field);

    // Không còn chứng từ nào được dùng → gỡ các giá trị do AI điền
    if (scanResults.length === 0) {
      if (owned.has("amount")) setForm((p) => ({ ...p, amount: undefined }));
      if (owned.has("description")) setForm((p) => ({ ...p, description: "" }));
      if (owned.has("title")) setTitle("");
      if (owned.has("expenseDate")) setExpenseDate("");
      markAiFilled(["amount", "description", "title", "expenseDate"], false);
      return;
    }

    const filled: AiField[] = [];

    const totals = scanResults
      .map((r) => r.fields.totalAmount)
      .filter((v): v is number => v != null);
    if (totals.length > 0 && canFill("amount", f.amount == null)) {
      const sum = totals.reduce((a, b) => a + b, 0);
      setForm((p) => ({ ...p, amount: sum }));
      filled.push("amount");
    }

    const dates = scanResults
      .map((r) => r.fields.invoiceDate)
      .filter((v): v is string => !!v)
      .sort();
    const latestDate = dates[dates.length - 1];
    if (latestDate && canFill("expenseDate", !d)) {
      setExpenseDate(latestDate);
      filled.push("expenseDate");
    }

    const suggestedTitle = scanResults.find((r) => r.suggestion.title)?.suggestion.title;
    if (suggestedTitle && canFill("title", !t.trim())) {
      setTitle(suggestedTitle);
      filled.push("title");
    }

    const drafts = scanResults
      .map((r) => r.suggestion.descriptionDraft)
      .filter((v): v is string => !!v);
    if (drafts.length > 0 && canFill("description", !(f.description ?? "").trim())) {
      setForm((p) => ({ ...p, description: drafts.join("\n\n").slice(0, AI_DESCRIPTION_MAX) }));
      filled.push("description");
    }

    markAiFilled(filled, true);
    if (filled.length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        filled.forEach((field) => delete next[field]);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi tập chứng từ thay đổi
  }, [scanKey, scanEligible]);

  // User chọn phase SAU khi tải chứng từ → hỏi AI chọn hạng mục (chỉ gửi văn bản, không gửi lại ảnh)
  useEffect(() => {
    if (form.type !== RequestType.EXPENSE || !form.phaseId || !aiEnabled) return;
    const first = scanResults[0];
    if (!first) return;
    const key = `${first.extractionId}:${form.phaseId}`;
    if (suggestedKeysRef.current.has(key)) return;
    suggestedKeysRef.current.add(key);

    const phaseId = form.phaseId;
    let cancelled = false;
    suggestReceiptCategory(first.extractionId, phaseId)
      .then((res) => {
        if (!cancelled && res.data.category) setAiCategory({ ...res.data.category, phaseId });
      })
      .catch(() => {
        // Không gợi ý được thì để user tự chọn
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanResults đại diện bởi scanKey
  }, [form.phaseId, form.type, scanKey, aiEnabled]);

  // Áp hạng mục AI đã chọn khi danh sách hạng mục của phase đã tải xong
  useEffect(() => {
    if (!aiCategory || form.type !== RequestType.EXPENSE || aiCategory.phaseId !== form.phaseId) return;
    if (!categoryOptions.some((c) => c.id === aiCategory.id)) return;
    if (form.categoryId != null && !aiFilledRef.current.has("categoryId")) return;
    if (form.categoryId === aiCategory.id) return;
    setForm((p) => ({ ...p, categoryId: aiCategory.id }));
    markAiFilled(["categoryId"], true);
    setFieldErrors((p) => ({ ...p, categoryId: undefined }));
  }, [aiCategory, categoryOptions, form.phaseId, form.categoryId, form.type, markAiFilled]);

  // Quyết toán: sau khi danh sách phase / hạng mục tải xong thì chọn đúng mục của khoản tạm ứng
  useEffect(() => {
    const prefill = advancePrefillRef.current;
    if (!prefill?.phaseId || !phases?.phases.some((p) => p.id === prefill.phaseId)) return;
    if (latestRef.current.form.phaseId !== prefill.phaseId) {
      setForm((p) => ({ ...p, phaseId: prefill.phaseId ?? undefined }));
    }
  }, [phases]);

  useEffect(() => {
    const prefill = advancePrefillRef.current;
    if (!prefill?.categoryId || !categoryOptions.some((c) => c.id === prefill.categoryId)) return;
    setForm((p) => ({ ...p, categoryId: prefill.categoryId ?? undefined }));
    advancePrefillRef.current = null;
  }, [categoryOptions]);

  const handleAdvanceChange = (id: number | undefined) => {
    setAdvanceBalanceId(id);
    setFieldErrors((p) => ({ ...p, advanceBalanceId: undefined, projectId: undefined, phaseId: undefined, categoryId: undefined }));

    const advance = advanceOptions.find((a) => a.id === id);
    if (!advance?.projectId) {
      setLinkedToAdvance(false);
      advancePrefillRef.current = null;
      return;
    }

    setLinkedToAdvance(true);
    advancePrefillRef.current = { phaseId: advance.phaseId, categoryId: advance.categoryId };

    if (form.projectId !== advance.projectId) {
      // Đổi dự án → effect tải phase → effect trên chọn phase → tải hạng mục → chọn hạng mục
      setForm((p) => ({ ...p, projectId: advance.projectId ?? undefined }));
    } else if (advance.phaseId && form.phaseId !== advance.phaseId) {
      if (phases?.phases.some((p) => p.id === advance.phaseId)) {
        setForm((p) => ({ ...p, phaseId: advance.phaseId ?? undefined }));
      }
    } else if (advance.categoryId && categoryOptions.some((c) => c.id === advance.categoryId)) {
      setForm((p) => ({ ...p, categoryId: advance.categoryId ?? undefined }));
      advancePrefillRef.current = null;
    }
  };

  useEffect(() => {
    if (!isReimburseType) {
      setLinkedToAdvance(false);
      advancePrefillRef.current = null;
    }
  }, [isReimburseType]);

  const setScanIgnored = (id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id && f.scan?.state === "done"
          ? { ...f, scan: { ...f.scan, ignored: !f.scan.ignored } }
          : f
      )
    );
  };

  const retryScan = (id: string) => {
    const item = files.find((f) => f.id === id);
    if (item) void scanFile(item.id, item.file);
  };

  const exceedsAdvance =
    isReimburseType &&
    selectedAdvance != null &&
    form.amount != null &&
    form.amount > selectedAdvance.remainingAmount;

  const handleAmountChange = (amount: number | null) => {
    setForm((prev) => ({ ...prev, amount: amount ?? undefined }));
    markAiFilled(["amount"], false);
    if (fieldErrors.amount) setFieldErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleAmountBlur = () => {
    const amt = form.amount;
    if (amt !== undefined && amt < 1_000) {
      setFieldErrors((p) => ({ ...p, amount: "Số tiền tối thiểu là 1.000 ₫." }));
    }
  };

  const handleTitleBlur = () => {
    const t = title.trim();
    if (t.length > 0 && t.length < 3) {
      setFieldErrors((p) => ({ ...p, title: "Tiêu đề cần ít nhất 3 ký tự." }));
    } else if (t.length > 200) {
      setFieldErrors((p) => ({ ...p, title: "Tiêu đề quá dài." }));
    }
  };

  const handleDescriptionBlur = () => {
    const d = (form.description ?? "").trim();
    if (d.length > 0 && d.length < 10) {
      setFieldErrors((p) => ({ ...p, description: "Mô tả cần ít nhất 10 ký tự." }));
    }
  };

  const handleExpenseDateBlur = () => {
    if (!expenseDate) {
      setFieldErrors((p) => ({ ...p, expenseDate: "Vui lòng chọn ngày chi tiêu." }));
    }
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    const accepted = selected.filter(
      (file) => file.type === "application/pdf" || file.type.startsWith("image/")
    );

    const mapped = accepted.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      file,
      // Tạo cho cả PDF để xem trong modal; thu hồi khi xoá file hoặc rời trang
      previewUrl: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...mapped]);

    event.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const validateBeforeSubmit = (): boolean => {
    const schema = z.object({
      type: z.enum(
        [RequestType.ADVANCE, RequestType.EXPENSE, RequestType.REIMBURSE] as const,
        { error: "Vui lòng chọn loại yêu cầu." }
      ),
      amount: z.number({ error: "Vui lòng nhập số tiền hợp lệ." }).min(1_000, "Số tiền tối thiểu là 1.000 ₫."),
      title: z.string().min(3, "Tiêu đề cần ít nhất 3 ký tự.").max(200, "Tiêu đề quá dài."),
      description: z.string().min(10, "Mô tả cần ít nhất 10 ký tự.").max(1000, "Mô tả không được vượt quá 1.000 ký tự."),
      projectId: isProjectBasedType
        ? z.number({ error: "Vui lòng chọn dự án." }).positive("Vui lòng chọn dự án.")
        : z.number().optional(),
      phaseId: isProjectBasedType
        ? z.number({ error: "Vui lòng chọn phase." }).positive("Vui lòng chọn phase.")
        : z.number().optional(),
      categoryId: isProjectBasedType
        ? z.number({ error: "Vui lòng chọn hạng mục chi phí." }).positive("Vui lòng chọn hạng mục chi phí.")
        : z.number().optional(),
      expenseDate: z.string().min(1, "Vui lòng chọn ngày chi tiêu."),
    });

    const result = schema.safeParse({
      type: form.type,
      amount: form.amount,
      title: title.trim(),
      description: form.description?.trim() ?? "",
      projectId: form.projectId,
      phaseId: form.phaseId,
      categoryId: form.categoryId,
      expenseDate,
    });

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        type: flat.type?.[0],
        amount: flat.amount?.[0],
        title: flat.title?.[0],
        description: flat.description?.[0],
        projectId: flat.projectId?.[0],
        phaseId: flat.phaseId?.[0],
        categoryId: flat.categoryId?.[0],
        expenseDate: flat.expenseDate?.[0],
      });
      return false;
    }

    if (isReimburseType && !advanceBalanceId) {
      setFieldErrors((prev) => ({
        ...prev,
        advanceBalanceId: "Vui lòng chọn khoản tạm ứng cần quyết toán.",
      }));
      return false;
    }

    const requiresAttachment =
      form.type === RequestType.EXPENSE || form.type === RequestType.REIMBURSE;
    if (requiresAttachment && files.length === 0) {
      toast.error("Yêu cầu Hoàn chi và Quyết toán tạm ứng bắt buộc phải đính kèm ít nhất 1 chứng từ.");
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateBeforeSubmit()) return;

    setSubmitting(true);

    try {
      const uploadedFiles = await uploadAttachments(files);

      const descriptionParts = [
        `Tiêu đề: ${title.trim()}`,
        `Ngày chi tiêu: ${expenseDate}`,
        form.description?.trim() ?? "",
      ].filter(Boolean);

      const payload: CreateRequestBody = {
        type: form.type as RequestType,
        amount: form.amount as number,
        projectId: form.projectId,
        phaseId: form.phaseId,
        categoryId: form.categoryId,
        advanceBalanceId: isReimburseType ? advanceBalanceId : undefined,
        description: descriptionParts.join("\n"),
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      };

      const res = await api.post<RequestDetailResponse>("/api/v1/requests", payload);
      toast.success("Yêu cầu đã được tạo thành công!");
      router.push(`/requests/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.apiMessage);
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Không thể tạo yêu cầu. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="h-44 animate-pulse rounded-3xl bg-white" />
        <div className="h-64 animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (!canCreatePersonalRequest) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-900/15">
          <div className="relative p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
            <div className="relative max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Yêu cầu · IFMS</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Tạo yêu cầu</h1>
              <p className="mt-3 text-sm leading-6 text-blue-100">
                Hệ thống chỉ hiển thị loại yêu cầu phù hợp với vai trò hiện tại của bạn.
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {roleCreateAction ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700">{currentRole}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{roleCreateAction.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {roleCreateAction.description}
                </p>
              </div>
              <Link
                href={roleCreateAction.href}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-500"
              >
                {roleCreateAction.action}
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Không có chức năng tạo yêu cầu</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Vai trò hiện tại của bạn không được cấu hình để tạo yêu cầu mới trong hệ thống.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => router.push("/requests")}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Danh sách yêu cầu
      </button>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-linear-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-900/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Hồ sơ yêu cầu · IFMS</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Tạo yêu cầu mới</h1>
            <p className="mt-2 text-sm text-blue-100">Chọn nghiệp vụ, dự án và nội dung chi; đính kèm tài liệu theo loại yêu cầu.</p>
          </div>
          <span className="w-fit rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold">3 phần thông tin</span>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 1. Loại yêu cầu + nơi chi tiêu ── */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">1. Loại yêu cầu và dự án</h2>
            <p className="mt-1 text-sm text-slate-500">Xác định khoản chi và nơi sử dụng ngân sách.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-3">Loại yêu cầu</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {REQUEST_TYPE_CONFIG.map(({ type, label, sub, cardSelected, cardHover, iconSelected, iconDefault, labelSelected, icon }) => {
                const selected = form.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, type }))}
                    className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${selected ? cardSelected : `border-slate-200 bg-white ${cardHover}`}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${selected ? iconSelected : iconDefault}`}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${selected ? labelSelected : "text-slate-900"}`}>{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isReimburseType && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Khoản tạm ứng cần quyết toán <span className="text-rose-500">*</span>
              </label>
              <select
                value={advanceBalanceId?.toString() ?? ""}
                onChange={(e) => handleAdvanceChange(Number(e.target.value) || undefined)}
                disabled={loadingAdvances}
                className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${fieldErrors.advanceBalanceId ? "border-rose-300" : "border-slate-200"}`}
              >
                <option value="">
                  {loadingAdvances ? "Đang tải..." : advanceOptions.length === 0 ? "Không có khoản tạm ứng còn dư" : "Chọn khoản tạm ứng"}
                </option>
                {advanceOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.requestCode} — còn {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(opt.remainingAmount)}
                    {opt.status === "PARTIALLY_SETTLED" ? " (đã quyết toán một phần)" : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.advanceBalanceId && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.advanceBalanceId}</p>
              )}
              {selectedAdvance && (
                <p className="text-xs text-teal-600 mt-1">
                  ✓ Đã chọn khoản tạm ứng
                  {linkedToAdvance && " — dự án, giai đoạn và hạng mục được lấy theo khoản tạm ứng gốc"}
                </p>
              )}
            </div>
          )}

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Dự án{linkedLocked && <AiFilledBadge kind="advance" />}
              </label>
              <select
                value={form.projectId?.toString() ?? ""}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setForm((prev) => ({ ...prev, projectId: Number.isFinite(value) && value > 0 ? value : undefined }));
                  if (fieldErrors.projectId) setFieldErrors((p) => ({ ...p, projectId: undefined }));
                }}
                disabled={!isProjectBasedType || loading || linkedLocked}
                className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.projectId ? "border-rose-300" : "border-slate-200"}`}
              >
                <option value="">Chọn dự án</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    [{project.projectCode}] {project.name}
                  </option>
                ))}
              </select>
              {fieldErrors.projectId && <p className="text-xs text-rose-600 mt-1">{fieldErrors.projectId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Giai đoạn{linkedLocked && <AiFilledBadge kind="advance" />}
              </label>
              <select
                value={form.phaseId?.toString() ?? ""}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setForm((prev) => ({ ...prev, phaseId: Number.isFinite(value) && value > 0 ? value : undefined, categoryId: undefined }));
                  if (fieldErrors.phaseId) setFieldErrors((p) => ({ ...p, phaseId: undefined }));
                }}
                disabled={!isProjectBasedType || !form.projectId || loadingPhases || linkedLocked}
                className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.phaseId ? "border-rose-300" : "border-slate-200"}`}
              >
                <option value="">{loadingPhases ? "Đang tải giai đoạn..." : form.projectId ? "Chọn giai đoạn" : "Chọn dự án trước"}</option>
                {(phases?.phases ?? []).map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    [{phase.phaseCode}] {phase.name}
                  </option>
                ))}
              </select>
              {fieldErrors.phaseId && <p className="text-xs text-rose-600 mt-1">{fieldErrors.phaseId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Hạng mục chi phí
                {linkedLocked ? <AiFilledBadge kind="advance" /> : aiFilled.has("categoryId") && <AiFilledBadge kind="ai" />}
              </label>
              <select
                value={form.categoryId?.toString() ?? ""}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setForm((prev) => ({ ...prev, categoryId: Number.isFinite(value) && value > 0 ? value : undefined }));
                  markAiFilled(["categoryId"], false);
                  if (fieldErrors.categoryId) setFieldErrors((p) => ({ ...p, categoryId: undefined }));
                }}
                disabled={!isProjectBasedType || !form.phaseId || loadingCategories || linkedLocked}
                className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.categoryId ? "border-rose-300" : "border-slate-200"}`}
              >
                <option value="">{loadingCategories ? "Đang tải hạng mục..." : form.phaseId ? "Chọn hạng mục" : "Chọn giai đoạn trước"}</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && <p className="text-xs text-rose-600 mt-1">{fieldErrors.categoryId}</p>}
            </div>
          </div>
          </div>
        </section>

        {/* ── 2. Chứng từ — AI đọc ngay khi tải lên ── */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">2. Chứng từ và tài liệu</h2>
            <p className="mt-1 text-sm text-slate-500">{form.type === RequestType.ADVANCE ? "Có thể thêm dự toán hoặc báo giá để làm căn cứ xem xét." : "Đính kèm hóa đơn hoặc biên nhận cho khoản chi thực tế."}</p>
          </div>
          <div className="p-5">
          <label className="mb-2 block text-sm font-medium text-slate-600">Tệp đính kèm (JPG, PNG, PDF)</label>

          {scanEligible && (
            <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              ✨ AI sẽ đọc chứng từ và tự điền <b>số tiền, ngày chi tiêu, tiêu đề, mô tả</b>
              {form.type === RequestType.EXPENSE && <> và <b>hạng mục chi phí</b></>}. Bạn chỉ cần kiểm tra lại
              và bổ sung mục đích chi.
              <span className="block text-xs text-violet-600 mt-1">
                Còn {aiStatus?.remainingToday ?? 0}/{aiStatus?.maxCallsPerDay ?? 0} lượt đọc hôm nay. Tải lại cùng một file không tốn lượt.
              </span>
            </div>
          )}

          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center bg-blue-50">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              onChange={handleFilesChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-2">
              Hỗ trợ nhiều file. Định dạng: JPG, PNG, PDF.
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setPreviewFileId(item.id)}
                      title="Xem chứng từ"
                      aria-label={`Xem chứng từ ${item.file.name}`}
                      className="group relative shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {item.previewUrl && isImage(item.file) ? (
                        <Image
                          src={item.previewUrl}
                          alt={item.file.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 cursor-zoom-in"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 cursor-zoom-in">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                      )}
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6m-3-3h6m4 0a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                    </button>

                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setPreviewFileId(item.id)}
                        className="block max-w-full truncate text-left text-sm text-slate-900 hover:text-blue-700 hover:underline"
                      >
                        {item.file.name}
                      </button>
                      <p className="text-xs text-slate-500">
                        {(item.file.size / 1024).toFixed(1)} KB
                      </p>
                      {scanEligible && item.scan && (
                        <ReceiptScanStatus
                          scan={item.scan}
                          onToggleIgnore={() => setScanIgnored(item.id)}
                          onRetry={() => retryScan(item.id)}
                        />
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-medium transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
          </div>
        </section>

        {previewItem && (
          <ReceiptPreviewModal
            file={previewItem.file}
            previewUrl={previewItem.previewUrl}
            scan={previewItem.scan}
            onClose={closePreview}
          />
        )}

        {/* ── 3. Nội dung chi — các ô AI có thể điền ── */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">3. Nội dung và số tiền</h2>
            <p className="mt-1 text-sm text-slate-500">{form.type === RequestType.ADVANCE ? "Nêu rõ mục đích sử dụng khoản tiền được tạm ứng." : "Kiểm tra thông tin được đọc từ chứng từ trước khi gửi."}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Số tiền (VND){aiFilled.has("amount") && <AiFilledBadge kind="ai" />}
            </label>
            <CurrencyInput
              value={form.amount ?? null}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              placeholder="Nhập số tiền"
              error={fieldErrors.amount}
            />
            {!fieldErrors.amount && (
              <p className="text-xs text-slate-500 mt-1">{form.amount ? `Giá trị: ${formatCurrency(form.amount)}` : ""}</p>
            )}
            {exceedsAdvance && selectedAdvance && (
              <p className="text-xs text-amber-700 mt-1">
                ⚠ Vượt số còn lại của khoản tạm ứng ({formatCurrency(selectedAdvance.remainingAmount)}). Quyết toán không được lớn hơn số còn lại.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Ngày chi tiêu{aiFilled.has("expenseDate") && <AiFilledBadge kind="ai" />}
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => {
                setExpenseDate(e.target.value);
                markAiFilled(["expenseDate"], false);
                if (fieldErrors.expenseDate) setFieldErrors((p) => ({ ...p, expenseDate: undefined }));
              }}
              onBlur={handleExpenseDateBlur}
              className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.expenseDate ? "border-rose-300" : "border-slate-200"}`}
            />
            {fieldErrors.expenseDate && <p className="text-xs text-rose-600 mt-1">{fieldErrors.expenseDate}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Tiêu đề{aiFilled.has("title") && <AiFilledBadge kind="ai" />}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markAiFilled(["title"], false);
                if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: undefined }));
              }}
              onBlur={handleTitleBlur}
              placeholder="Ví dụ: Tạm ứng công tác tháng 4"
              className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.title ? "border-rose-300" : "border-slate-200"}`}
            />
            {fieldErrors.title && <p className="text-xs text-rose-600 mt-1">{fieldErrors.title}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Mô tả chi tiết{aiFilled.has("description") && <AiFilledBadge kind="ai" />}
            </label>
            <textarea
              rows={aiFilled.has("description") ? 7 : 4}
              value={form.description ?? ""}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, description: e.target.value }));
                markAiFilled(["description"], false);
                if (fieldErrors.description) setFieldErrors((p) => ({ ...p, description: undefined }));
              }}
              onBlur={handleDescriptionBlur}
              placeholder="Mô tả nội dung chi tiêu..."
              className={`w-full px-4 py-3 rounded-2xl border bg-white text-slate-900 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${fieldErrors.description ? "border-rose-300" : "border-slate-200"}`}
            />
            {aiFilled.has("description") && !fieldErrors.description && (
              <p className="text-xs text-violet-700 mt-1">Hãy bổ sung mục đích chi (chi cho việc gì) — AI không biết phần này.</p>
            )}
            {fieldErrors.description && <p className="text-xs text-rose-600 mt-1">{fieldErrors.description}</p>}
          </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            onClick={() => router.push("/requests")}
            className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang tạo...
              </>
            ) : (
              "Gửi yêu cầu"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
