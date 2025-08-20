// Shared styles for consistent UI across the application

export const lightColors = {
  primary: '#007bff',
  primaryHover: '#0056b3',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  light: '#f8f9fa',
  dark: '#343a40',
  white: '#ffffff',
  border: '#dee2e6',
  borderLight: '#e9ecef',
  text: '#495057',
  textMuted: '#6c757d',
  textDark: '#2c3e50',
  // Status colors for light mode
  statusPass: '#155724',
  statusPassBg: '#d4edda',
  statusWarning: '#856404',
  statusWarningBg: '#fff3cd',
  statusFail: '#721c24',
  statusFailBg: '#f8d7da',
  // Rule level colors for light mode
  essentialBg: '#fff5f5',
  essentialBorder: '#dc3545',
  recommendedBg: '#fffbf0',
  recommendedBorder: '#ffc107'
}

export const darkColors = {
  primary: '#4fc3f7',
  primaryHover: '#29b6f6',
  secondary: '#90a4ae',
  success: '#66bb6a',
  warning: '#ffb74d',
  danger: '#ef5350',
  light: '#1e1e1e',
  dark: '#0f0f0f',
  white: '#2a2a2e',
  border: '#3a3a3f',
  borderLight: '#2d2d32',
  text: '#e4e4e7',
  textMuted: '#a1a1aa',
  textDark: '#f4f4f5',
  // Better status colors for dark mode
  statusPass: '#22c55e',
  statusPassBg: '#1f2937',
  statusWarning: '#f59e0b',
  statusWarningBg: '#1f2937',
  statusFail: '#ef4444',
  statusFailBg: '#1f2937',
  // Better rule level colors for dark mode
  essentialBg: '#1f2937',
  essentialBorder: '#ef4444',
  recommendedBg: '#1f2937',
  recommendedBorder: '#f59e0b'
}

// Default to light mode
export const colors = lightColors

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px'
}

export const fonts = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace'
}

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  md: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
  lg: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)'
}

export const buttonStyles = {
  base: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
    fontFamily: fonts.system
  },
  primary: {
    backgroundColor: colors.primary,
    color: colors.white,
  },
  secondary: {
    backgroundColor: colors.secondary,
    color: colors.white,
  },
  success: {
    backgroundColor: colors.success,
    color: colors.white,
  },
  small: {
    padding: '6px 12px',
    fontSize: '12px'
  },
  // Original style buttons (like spans)
  edit: {
    fontSize: '10px',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '3px 6px',
    backgroundColor: colors.light,
    borderRadius: '3px',
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
    userSelect: 'none',
    display: 'inline-block'
  },
  save: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#155724',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '3px 6px',
    backgroundColor: '#d4edda',
    borderRadius: '3px',
    border: '1px solid #c3e6cb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    userSelect: 'none',
    display: 'inline-block'
  },
  cancel: {
    fontSize: '10px',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '3px 6px',
    backgroundColor: colors.light,
    borderRadius: '3px',
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
    userSelect: 'none',
    display: 'inline-block'
  }
}

export const inputStyles = {
  base: {
    padding: '12px 16px',
    fontSize: '14px',
    border: `2px solid #dee2e6`, // Will be overridden by theme
    borderRadius: '8px',
    backgroundColor: '#ffffff', // Will be overridden by theme
    outline: 'none',
    transition: 'border-color 0.2s ease',
    fontFamily: fonts.system,
    boxSizing: 'border-box'
  },
  focus: {
    borderColor: '#007bff', // Will be overridden by theme
    boxShadow: `0 0 0 3px rgba(0, 123, 255, 0.2)`
  }
}

export const cardStyles = {
  base: {
    backgroundColor: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    boxShadow: shadows.sm,
    transition: 'all 0.2s ease'
  },
  hover: {
    boxShadow: shadows.md,
    transform: 'translateY(-1px)'
  }
}

export const createButton = (variant = 'primary', size = 'base', customStyles = {}) => ({
  ...buttonStyles.base,
  ...buttonStyles[variant],
  ...(size !== 'base' ? buttonStyles[size] : {}),
  ...customStyles
})

export const createInput = (customStyles = {}) => ({
  ...inputStyles.base,
  ...customStyles
})

export const createThemedInput = (colors, customStyles = {}) => ({
  ...inputStyles.base,
  border: `2px solid ${colors.borderLight}`,
  backgroundColor: colors.white,
  color: colors.text,
  ...customStyles
})

export const createCard = (customStyles = {}) => ({
  ...cardStyles.base,
  ...customStyles
})

export const createEditButton = (customStyles = {}) => ({
  ...buttonStyles.edit,
  ...customStyles
})

export const createSaveButton = (customStyles = {}) => ({
  ...buttonStyles.save,
  ...customStyles
})

export const createCancelButton = (customStyles = {}) => ({
  ...buttonStyles.cancel,
  ...customStyles
})