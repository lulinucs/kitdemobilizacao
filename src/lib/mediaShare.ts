import type { MediaItem } from './media'

export async function shareMaterial(item: MediaItem, url: string): Promise<'file' | 'link' | 'unavailable' | 'cancelled' | 'error'> {
  if (!navigator.share) return 'unavailable'
  if (navigator.canShare) {
    try {
      const response = await fetch(item.path)
      if (response.ok) {
        const file = new File([await response.blob()], item.originalName, { type: item.mime })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: item.title })
          return 'file'
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.share({ title: item.title, url })
    return 'link'
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'error'
  }
}
