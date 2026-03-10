import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Users } from 'lucide-react'
import Header from '../components/layout/Header'
import ProfileCard from '../components/profiles/ProfileCard'
import Dialog from '../components/ui/Dialog'
import Spinner from '../components/ui/Spinner'
import { useAppStore } from '../store'

export default function ProfilesPage() {
  const navigate = useNavigate()
  const { profiles, profilesLoading, fetchProfiles, deleteProfile } = useAppStore()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteProfile(deleteId)
    setDeleteId(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Header
        title="Voice Profiles"
        subtitle="Manage your voice profiles for speech generation"
        actions={
          <button onClick={() => navigate('/profiles/new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        }
      />

      {profilesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-400 mb-2">No profiles yet</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-sm">
            Create a voice profile by recording or importing a reference audio sample.
          </p>
          <button
            onClick={() => navigate('/profiles/new')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProfileCard
                profile={profile}
                onEdit={(id) => navigate(`/profiles/${id}/edit`)}
                onDelete={setDeleteId}
              />
            </motion.div>
          ))}
        </div>
      )}

      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Profile"
        actions={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </>
        }
      >
        <p>Are you sure you want to delete this profile? This will also remove the reference audio and any associated data.</p>
      </Dialog>
    </motion.div>
  )
}
