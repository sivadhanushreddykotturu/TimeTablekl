import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
} from 'sonner';
import {
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';

/* ─── variant maps ─── */

const variantStyles = {
  success: {
    border: '1px solid rgba(40, 167, 69, 0.5)',
    iconColor: '#28a745',
    titleColor: '#28a745',
  },
  error: {
    border: '1px solid rgba(220, 53, 69, 0.5)',
    iconColor: '#dc3545',
    titleColor: '#dc3545',
  },
  info: {
    border: '1px solid rgba(207, 255, 4, 0.35)',
    iconColor: '#cfff04',
    titleColor: '#cfff04',
  },
};

const variantIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
};

/* ─── internal custom toast content ─── */

function ToastContent({ toastId, message, variant, onDismiss }) {
  const v = variantStyles[variant] || variantStyles.info;
  const Icon = variantIcons[variant] || Info;

  return (
    <motion.div
      variants={toastAnimation}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '340px',
        padding: '12px 16px',
        borderRadius: '0px',
        border: v.border,
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        backgroundColor: 'var(--np-carbon, #131316)',
        color: 'var(--np-cream, #f4f2ea)',
        fontFamily: "var(--np-font-ui, 'Space Grotesk', 'Segoe UI', sans-serif)",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
        <Icon
          style={{
            width: '18px',
            height: '18px',
            flexShrink: 0,
            marginTop: '1px',
            color: v.iconColor,
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.45,
            color: 'var(--np-cream, #f4f2ea)',
            fontFamily: "var(--np-font-ui, 'Space Grotesk', 'Segoe UI', sans-serif)",
            wordBreak: 'break-word',
          }}
        >
          {message}
        </p>
      </div>

      <button
        onClick={() => {
          sonnerToast.dismiss(toastId);
          onDismiss?.();
        }}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          marginLeft: '10px',
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: '0px',
          color: 'var(--np-muted, #8b8b95)',
          cursor: 'pointer',
          transition: 'background 0.2s, color 0.2s',
          minHeight: 'auto',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--np-well, #0e0e11)';
          e.currentTarget.style.color = 'var(--np-cream, #f4f2ea)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--np-muted, #8b8b95)';
        }}
      >
        <X style={{ width: '14px', height: '14px' }} />
      </button>
    </motion.div>
  );
}

/* ─── singleton Sonner host – mount once in App ─── */

let sonnerMounted = false;

export function ToasterProvider() {
  sonnerMounted = true;
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
        },
      }}
    />
  );
}

/* ─── drop-in replacement for the old <Toast /> ─── */

let activeToastId = null;

export default function Toast({ message, type = 'success', isVisible, onClose }) {
  const prevVisible = useRef(false);

  useEffect(() => {
    // Transition from hidden → visible: fire a sonner toast
    if (isVisible && !prevVisible.current) {
      // dismiss any prior toast so they don't stack
      if (activeToastId !== null) {
        sonnerToast.dismiss(activeToastId);
      }

      activeToastId = sonnerToast.custom(
        (toastId) => (
          <ToastContent
            toastId={toastId}
            message={message}
            variant={type}
            onDismiss={onClose}
          />
        ),
        {
          duration: 3000,
          position: 'bottom-right',
          onDismiss: () => {
            activeToastId = null;
            onClose?.();
          },
          onAutoClose: () => {
            activeToastId = null;
            onClose?.();
          },
        }
      );
    }

    // Transition from visible → hidden: dismiss
    if (!isVisible && prevVisible.current) {
      if (activeToastId !== null) {
        sonnerToast.dismiss(activeToastId);
        activeToastId = null;
      }
    }

    prevVisible.current = isVisible;
  }, [isVisible, message, type, onClose]);

  // The actual rendering is handled by the SonnerToaster host.
  return null;
}

/* ─── imperative ref-based API (advanced usage) ─── */

export const ToasterRef = forwardRef(({ defaultPosition = 'bottom-right' }, ref) => {
  useImperativeHandle(ref, () => ({
    show({ title, message, variant = 'info', duration = 4000, position = defaultPosition, onDismiss }) {
      sonnerToast.custom(
        (toastId) => (
          <ToastContent
            toastId={toastId}
            message={title ? `${title} — ${message}` : message}
            variant={variant}
            onDismiss={onDismiss}
          />
        ),
        { duration, position }
      );
    },
  }));

  return (
    <SonnerToaster
      position={defaultPosition}
      toastOptions={{
        unstyled: true,
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
        },
      }}
    />
  );
});