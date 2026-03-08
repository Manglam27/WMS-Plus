import { Container } from 'react-bootstrap'

function LandingPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Container className="text-center py-5">
        <h1 className="display-4 fw-bold mb-3">WMS-Plus</h1>
        <p className="lead text-muted mb-4">
          Warehouse Management System
        </p>
        <p className="text-secondary">
          Streamline order processing, inventory control, and delivery workflows.
        </p>
      </Container>
    </div>
  )
}

export default LandingPage
