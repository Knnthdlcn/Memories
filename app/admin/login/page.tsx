'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage(){
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      
      const data = await res.json()
      
      if (data.success) {
        // Login successful - wait a moment for cookie to be set
        setTimeout(() => {
          window.location.href = '/admin'
        }, 100)
      } else {
        setError('Invalid password')
        setIsLoading(false)
      }
    } catch (err) {
      setError('Login failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="soft-card p-8 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            name="password" 
            type="password" 
            placeholder="Password" 
            className="w-full p-2 rounded border"
            disabled={isLoading}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-primary text-white rounded disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
