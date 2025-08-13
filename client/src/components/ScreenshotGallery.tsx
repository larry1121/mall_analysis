import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Download, Trash2, ExternalLink } from 'lucide-react'
import axios from 'axios'

interface Screenshot {
  filename: string
  url: string
  size: number
  createdAt: string
}

interface ScreenshotGalleryProps {
  runId?: string
  screenshots?: {
    main?: string
    actions?: string[]
    localPath?: string
  }
}

export default function ScreenshotGallery({ runId, screenshots }: ScreenshotGalleryProps) {
  const [galleryImages, setGalleryImages] = useState<Screenshot[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchScreenshots()
  }, [])

  const fetchScreenshots = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/screenshots/list')
      if (response.data.success) {
        setGalleryImages(response.data.screenshots)
      }
    } catch (error) {
      console.error('Failed to fetch screenshots:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteScreenshot = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) return
    
    try {
      await axios.delete(`/api/screenshots/${filename}`)
      await fetchScreenshots()
    } catch (error) {
      console.error('Failed to delete screenshot:', error)
    }
  }

  const downloadScreenshot = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB'
    else return Math.round(bytes / 1048576) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="screenshot-gallery">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Screenshots</h3>
        <button
          onClick={fetchScreenshots}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Current Run Screenshots */}
      {screenshots?.main && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Current Analysis</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative group cursor-pointer"
              onClick={() => setSelectedImage(screenshots.main!)}
            >
              <img
                src={screenshots.main}
                alt="Main screenshot"
                className="w-full h-32 object-cover rounded-lg shadow-md"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                Main
              </span>
            </motion.div>

            {screenshots.actions?.map((action, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05 }}
                className="relative group cursor-pointer"
                onClick={() => setSelectedImage(action)}
              >
                <img
                  src={action}
                  alt={`Action ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg shadow-md"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg flex items-center justify-center">
                  <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-50 text-white px-1 rounded">
                  Action {index + 1}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* All Screenshots Gallery */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : galleryImages.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">All Screenshots</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map((image) => (
              <motion.div
                key={image.filename}
                whileHover={{ scale: 1.05 }}
                className="relative group"
              >
                <img
                  src={image.url}
                  alt={image.filename}
                  className="w-full h-32 object-cover rounded-lg shadow-md cursor-pointer"
                  onClick={() => setSelectedImage(image.url)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                    <div className="text-white text-xs">
                      <div>{formatFileSize(image.size)}</div>
                      <div>{formatDate(image.createdAt)}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadScreenshot(image.url, image.filename)
                        }}
                        className="p-1 bg-white/20 hover:bg-white/30 rounded backdrop-blur-sm"
                      >
                        <Download size={14} className="text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteScreenshot(image.filename)
                        }}
                        className="p-1 bg-white/20 hover:bg-white/30 rounded backdrop-blur-sm"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No screenshots available
        </div>
      )}

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-7xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                  onClick={() => setZoom(zoom * 1.2)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm"
                >
                  <ZoomIn className="text-white" />
                </button>
                <button
                  onClick={() => setZoom(zoom * 0.8)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm"
                >
                  <ZoomOut className="text-white" />
                </button>
                <button
                  onClick={() => window.open(selectedImage, '_blank')}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm"
                >
                  <ExternalLink className="text-white" />
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-sm"
                >
                  <X className="text-white" />
                </button>
              </div>
              <img
                src={selectedImage}
                alt="Full size screenshot"
                className="rounded-lg"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}