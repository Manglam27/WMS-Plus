import { Card } from 'react-bootstrap'

function SalesPersonPage() {
  return (
    <>
      <h2 className="mb-4">Sales Person</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            Enter customer name, select products, view prices. Create and submit orders from the field.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default SalesPersonPage
