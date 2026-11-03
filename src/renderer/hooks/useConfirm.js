import { useCallback, useState } from 'react';

// 统一确认对话框状态。用 ref 保存回调之外的语义：同一时刻只有一个确认框。
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: '确认操作',
    message: '',
    confirmText: '确定',
    cancelText: '取消',
    tone: 'danger',
  });

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  // 返回 Promise<boolean>，调用方直接 await，避免回调套回调
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title || '确认操作',
        message: options.message || '',
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        tone: options.tone || 'danger',
        onResolve: resolve,
      });
    });
  }, []);

  const resolveWith = useCallback((value) => {
    setState((prev) => {
      if (prev.onResolve) prev.onResolve(value);
      return { ...prev, open: false, onResolve: null };
    });
  }, []);

  return { confirmState: state, confirm, resolveWith, close };
}
