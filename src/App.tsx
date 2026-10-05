import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { AppFooter } from './components/AppFooter'
import { BottomTabs } from './components/BottomTabs'
import { Stepper } from './components/Stepper'
import { HomeScreen } from './screens/HomeScreen'
import { SearchScreen } from './screens/SearchScreen'
import { MerchantScreen } from './screens/MerchantScreen'
import { PayScreen } from './screens/PayScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { LinkScreen } from './screens/LinkScreen'
import { UpiIdScreen } from './screens/UpiIdScreen'
import { AnalyzingScreen } from './screens/AnalyzingScreen'
import { ReportScreen } from './screens/ReportScreen'
import { DecisionScreen } from './screens/DecisionScreen'
import { NotFoundScreen } from './screens/NotFoundScreen'
import { WalletProvider } from './state/wallet'

/**
 * The scanner pulls in the jsQR decoder (~50 kB gzipped), so it is only
 * fetched when the visitor actually opens the scan screen.
 */
const ScanScreen = lazy(() =>
  import('./screens/ScanScreen').then((m) => ({ default: m.ScanScreen })),
)

/** Routes that keep the GPay-style bottom tab bar visible. */
const TABBED = ['/', '/search', '/merchant', '/pay', '/history', '/scan']

function RouteFallback() {
  return (
    <>
      <Stepper current={0} />
      <div className="container analysing">
        <h1 className="analysing__title">Loading the scanner</h1>
        <ol className="analysing__list">
          <li className="analysing__step is-active">
            <span className="analysing__dot" />
            Preparing the camera and QR decoder
          </li>
        </ol>
      </div>
    </>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const tabbed = TABBED.some((route) => pathname === route || pathname.startsWith(route + '/'))

  return (
    <div className="app">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/merchant/:id" element={<MerchantScreen />} />
          <Route path="/pay/:id" element={<PayScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route
            path="/scan"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ScanScreen />
              </Suspense>
            }
          />
          <Route path="/link" element={<LinkScreen />} />
          <Route path="/upi" element={<UpiIdScreen />} />
          <Route path="/verify" element={<UpiIdScreen />} />
          <Route path="/analyse" element={<AnalyzingScreen />} />
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/decision" element={<DecisionScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </main>
      {tabbed ? <BottomTabs /> : null}
      <AppFooter />
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <Shell />
    </WalletProvider>
  )
}
