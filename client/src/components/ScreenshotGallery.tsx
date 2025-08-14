import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react'

interface ScreenshotGalleryProps {
  runId?: string
  screenshots?: {
    main?: string
    actions?: string[]
    localPath?: string
  }
}

export default function ScreenshotGallery({ runId, screenshots }: ScreenshotGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)


  return (
    <div className="screenshot-gallery">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">분석 스크린샷</h3>
      </div>

      {/* Current Run Screenshots */}
      {screenshots?.main && (
        <div>
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