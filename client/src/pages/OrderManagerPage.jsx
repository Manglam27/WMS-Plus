import { Card } from 'react-bootstrap'

function OrderManagerPage() {
  return (
    <>
      <h2 className="mb-4">Order Manager</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            Review orders, edit or delete products, assign orders to packers. Orders and assignment tools will appear here.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default OrderManagerPage
