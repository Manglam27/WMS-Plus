import { Card } from 'react-bootstrap'

function ScannerPackerPage() {
  return (
    <>
      <h2 className="mb-4">Scanner / Packer</h2>
      <Card>
        <Card.Body>
          <p className="text-muted mb-0">
            View assigned orders, print sales order slips for pickers, scan barcodes, enter box count and packed quantities.
          </p>
        </Card.Body>
      </Card>
    </>
  )
}

export default ScannerPackerPage
