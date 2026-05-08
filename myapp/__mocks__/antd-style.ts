const cx = (...args: any[]) => args.filter(Boolean).join(' ');

export const createStyles = () => () => ({
  cx,
  styles: {
    root: 'mock-root',
    reviewBox: 'mock-reviewBox',
    reviewMetaBlock: 'mock-reviewMetaBlock',
    reviewActions: 'mock-reviewActions',
  },
});
