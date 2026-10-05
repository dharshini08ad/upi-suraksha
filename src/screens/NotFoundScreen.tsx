import { Link } from 'react-router-dom'
import { IconArrowLeft } from '../components/Icons'

export function NotFoundScreen() {
  return (
    <div className="container page">
      <header className="page__head">
        <span className="eyebrow">Error 404</span>
        <h1 className="page__title">This page is not part of the service</h1>
        <p className="page__lede">
          The address you followed does not match any screen of UPI Kavach. Start again from the
          verification home page.
        </p>
      </header>
      <Link to="/" className="btn btn--outline">
        <IconArrowLeft /> Back to home
      </Link>
    </div>
  )
}
