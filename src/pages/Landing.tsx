import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import Hero from '../sections/Hero'
import Statement from '../sections/Statement'
import How from '../sections/How'
import TwoLights from '../sections/TwoLights'
import Trust from '../sections/Trust'
import Privacy from '../sections/Privacy'
import Reviewers from '../sections/Reviewers'
import Install from '../sections/Install'
import Open from '../sections/Open'
import { scrollToId } from '../lib/smooth'

export default function Landing() {
  const { hash } = useLocation()

  // arriving from another page with /#section: wait for pins to measure, then glide there
  useEffect(() => {
    if (!hash) return
    const id = setTimeout(() => scrollToId(hash.slice(1)), 300)
    return () => clearTimeout(id)
  }, [hash])

  useEffect(() => { document.title = 'Stellarcope: trusted analytics for Stellar' }, [])

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Statement />
        <How />
        <TwoLights />
        <Trust />
        <Privacy />
        <Reviewers />
        <Install />
        <Open />
      </main>
      <Footer />
    </>
  )
}
