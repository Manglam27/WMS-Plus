import { Card } from 'react-bootstrap'

function DriverPage() {
  return (
    <>
      <h2 className="mb-4">Driver</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            View assigned deliveries, load orders, update status to shipped/delivered/undelivered. Add payment details and proof of delivery.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default DriverPage
