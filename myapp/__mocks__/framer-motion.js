const React = require('react');

const motion = new Proxy(
  {},
  {
    get(_, tag) {
      return React.forwardRef(function MotionElement(props, ref) {
        const {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          whileInView,
          viewport,
          variants,
          custom,
          ...rest
        } = props;
        return React.createElement(tag, {
          ...rest,
          ref,
          'data-motion-initial': initial
            ? JSON.stringify(initial)
            : undefined,
          'data-motion-animate': animate
            ? JSON.stringify(animate)
            : undefined,
          'data-motion-exit': exit ? JSON.stringify(exit) : undefined,
          'data-motion-while-in-view': whileInView
            ? JSON.stringify(whileInView)
            : undefined,
          'data-motion-transition': transition
            ? JSON.stringify(transition)
            : undefined,
        });
      });
    },
  },
);

module.exports = {
  motion,
  useInView: () => true,
  useMotionValue: (v) => ({ get: () => v, set: () => {}, on: () => {} }),
  useTransform: (val) => val,
  AnimatePresence: ({ children }) => children,
};
