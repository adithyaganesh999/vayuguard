'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Ban, CheckCircle, Search, MoreVertical, Mail, Calendar } from 'lucide-react';

const MOCK_USERS = [
  { id: '1', name: 'Rahul Sharma', email: 'rahul@example.com', role: 'user', status: 'active', joined: '2024-01-15', lastActive: '2 hours ago' },
  { id: '2', name: 'Priya Patel', email: 'priya@example.com', role: 'admin', status: 'active', joined: '2023-11-20', lastActive: '1 day ago' },
  { id: '3', name: 'Amit Kumar', email: 'amit@example.com', role: 'user', status: 'suspended', joined: '2024-03-08', lastActive: '5 days ago' },
  { id: '4', name: 'Sneha Reddy', email: 'sneha@example.com', role: 'moderator', status: 'active', joined: '2024-02-14', lastActive: '3 hours ago' },
  { id: '5', name: 'Vikram Singh', email: 'vikram@example.com', role: 'user', status: 'active', joined: '2024-04-01', lastActive: '12 hours ago' },
];

const ROLE_COLORS = {
  admin: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  moderator: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  user: { bg: 'bg-white/10', text: 'text-white/50' },
};

const STATUS_COLORS = {
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  suspended: { bg: 'bg-red-500/20', text: 'text-red-400' },
  inactive: { bg: 'bg-white/10', text: 'text-white/30' },
};

export default function UserManagement() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const toggleStatus = (id) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
          : u
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">User Management</h3>
        <span className="text-white/30 text-xs">{users.length} users</span>
      </div>

      {/* Search and filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 rounded-lg glass text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg glass text-white/50 text-sm bg-transparent focus:outline-none"
        >
          <option value="all" className="bg-neutral-900">All</option>
          <option value="admin" className="bg-neutral-900">Admin</option>
          <option value="moderator" className="bg-neutral-900">Moderator</option>
          <option value="user" className="bg-neutral-900">User</option>
        </select>
      </div>

      {/* User table */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredUsers.map((user, i) => {
          const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.user;
          const statusStyle = STATUS_COLORS[user.status] || STATUS_COLORS.inactive;
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold text-sm">
                  {user.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{user.name}</div>
                <div className="flex items-center gap-2">
                  <Mail size={10} className="text-white/20" />
                  <span className="text-white/30 text-xs truncate">{user.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[10px] ${roleStyle.bg} ${roleStyle.text}`}>
                  {user.role}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${statusStyle.bg} ${statusStyle.text}`}>
                  {user.status}
                </span>
              </div>
              <button
                onClick={() => toggleStatus(user.id)}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white/50 transition-colors"
                title={user.status === 'active' ? 'Suspend' : 'Activate'}
              >
                {user.status === 'active' ? <Ban size={12} /> : <CheckCircle size={12} />}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
