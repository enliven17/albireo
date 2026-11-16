import { Link } from 'react-router-dom'
import AsciiSky from '../components/AsciiSky'

export default function NotFound() {
  return (
    <main id="main" className="relative grid h-svh place-items-center overflow-hidden">
      <div className="absolute inset-0 opacity-60"><AsciiSky stars={false} /></div>
      <div className="relative text-center">
        <p className="num text-[clamp(5rem,16vw,12rem)] leading-none text-dim">404</p>
        <p className="mt-4 text-mute">This part of the sky is empty.</p>
        <Link to="/" className="btn btn-solid mt-8">Back to Stellarcope <span className="arrow">→</span></Link>
      </div>
    </main>
  )
}
