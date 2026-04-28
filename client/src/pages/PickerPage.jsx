import { Card } from 'react-bootstrap'

function PickerPage() {
  return (
    <>
      <h2 className="mb-4">Picker</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            View orders to pick, collect items from warehouse, deliver to packer.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default PickerPage
