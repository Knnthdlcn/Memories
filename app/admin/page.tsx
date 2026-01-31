'use client'

import AdminPanel from '@/src/components/AdminPanel'

export default function AdminPage(){
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Admin Dashboard</h2>
        <AdminPanel />
      </div>
    </div>
  )
}
