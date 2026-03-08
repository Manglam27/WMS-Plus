import { Card } from 'react-bootstrap'

function InventoryReceiverPage() {
  return (
    <>
      <h2 className="mb-4">Inventory Receiver</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            Receive stock, create POs by vendor and invoice number, enter items. Submit to Inventory Manager for approval.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default InventoryReceiverPage
