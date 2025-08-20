import { createContext, useContext, useState, useEffect } from 'react'
import { lightColors, darkColors } from './styles'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode')
    if (savedTheme !== null) {
      setIsDarkMode(JSON.parse(savedTheme))
    }
  }, [])

  // Save theme preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev)
  }

  const colors = isDarkMode ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}