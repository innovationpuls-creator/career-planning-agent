export const ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
].map((item) => ({ label: item.label, value: item.value }));

export const STATUS_OPTIONS = [
  { label: '启用', value: true },
  { label: '禁用', value: false },
].map((item) => ({ label: item.label, value: item.value }));
