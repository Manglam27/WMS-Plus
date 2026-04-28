import { Card, Table } from 'react-bootstrap'

function AssignDriverPage() {
  return (
    <>
      <h2 className="mb-2">Assign Driver</h2>
      <div className="small text-muted mb-3">Home / Orders / Assign Driver</div>
      <Card>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0" size="sm">
            <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
              <tr>
                <th>Order No</th>
                <th>Customer</th>
                <th>Delivery Date</th>
                <th>Driver</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  Driver assignment workflow will be added here.
                </td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </>
  )
}

export default AssignDriverPage

