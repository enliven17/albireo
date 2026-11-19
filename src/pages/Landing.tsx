import { useEffect } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import Hero from '../sections/Hero'
import Statement from '../sections/Statement'
import Privacy from '../sections/Privacy'
import Open from '../sections/Open'

export default function Landing() {
  useEffect(() => { document.title = 'Stellarcope: trusted analytics for Stellar' }, [])

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Statement />
        <Privacy />
        <Open />
      </main>
      <Footer />
    </>
  )
}
