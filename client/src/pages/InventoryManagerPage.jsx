import { useEffect, useMemo, useState } from 'react'
import { Card, Nav, Form, Button, Table, Badge, Row, Col, ProgressBar, Modal } from 'react-bootstrap'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  admin: 'Admin',
  accounts: 'Accounts',
  order_manager: 'Order Manager',
  inventory_manager: 'Inventory Manager',
  inventory_receiver: 'Inventory Receiver',
  sales_manager: 'Sales Manager',
  scanner_packer: 'Packer',
  picker: 'Picker',
  sales_person: 'Sales Person',
  driver: 'Driver',
}

export function StockUpdateTab() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    barcode: '',
    productSearch: '',
    selectedProduct: '',
    remark: '',
  })
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [securityCode, setSecurityCode] = useState('')

  const [unitRows, setUnitRows] = useState([
    { unitType: 'Piece', qtyPerUnit: 1, qty: '' },
    { unitType: 'Case', qtyPerUnit: 12, qty: '' },
  ])
  const [products, setProducts] = useState([])

  useEffect(() => {
    let alive = true
    api
      .get('/api/products?limit=all&status=Active')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || 'Failed to load products')
        if (!alive) return
        const all = Array.isArray(data.items) ? data.items : []
        setProducts(all)
      })
      .catch(() => {
        if (!alive) return
        setProducts([])
      })

    return () => {
      alive = false
    }
  }, [])

  const findProductByQuery = (raw) => {
    const query = String(raw || '').trim().toLowerCase()
    if (!query) return null

    return products.find((p) => {
      const idMatch = p.productId?.toLowerCase().includes(query)
      const nameMatch = p.productName?.toLowerCase().includes(query)
      const barcodeMatch = (p.packings || []).some((pk) => {
        if (!pk.barcode) return false
        const code = String(pk.barcode).toLowerCase()
        return code.includes(query)
      })
      return idMatch || nameMatch || barcodeMatch
    })
  }

  const findProductByBarcode = (raw) => {
    const query = String(raw || '').trim().toLowerCase()
    if (!query) return null

    let exact = products.find((p) =>
      (p.packings || []).some((pk) => pk.barcode && String(pk.barcode).toLowerCase() === query),
    )
    if (exact) return exact

    return products.find((p) =>
      (p.packings || []).some((pk) => {
        if (!pk.barcode) return false
        return String(pk.barcode).toLowerCase().includes(query)
      }),
    )
  }

  const handleChange = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))

    if (field === 'selectedProduct') {
      const product = products.find((p) => p._id === value)
      if (product) {
        const enabledPackings = (product.packings || []).filter((p) => p.enabled !== false)
        const nextRows = []
        const piece = enabledPackings.find((p) => p.unitType === 'Piece')
        nextRows.push({
          unitType: 'Piece',
          qtyPerUnit: piece?.qty || 1,
          qty: '',
        })
        enabledPackings
          .filter((p) => p.unitType && p.unitType !== 'Piece')
          .forEach((p) => {
            nextRows.push({
              unitType: p.unitType,
              qtyPerUnit: p.qty || 1,
              qty: '',
            })
          })
        setUnitRows(nextRows)
      } else {
        setUnitRows([
          { unitType: 'Piece', qtyPerUnit: 1, qty: '' },
          { unitType: 'Case', qtyPerUnit: 12, qty: '' },
        ])
      }
    }
  }

  const handleProductSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return

    const match = findProductByQuery(form.productSearch)

    if (!match) {
      // eslint-disable-next-line no-alert
      window.alert('No product found for that search.')
      return
    }

    const fakeEvent = { target: { value: match._id } }
    handleChange('selectedProduct')(fakeEvent)
  }

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return

    const match = findProductByBarcode(form.barcode)

    if (!match) {
      // eslint-disable-next-line no-alert
      window.alert('No product found for that barcode.')
      return
    }

    const fakeEvent = { target: { value: match._id } }
    handleChange('selectedProduct')(fakeEvent)
  }

  const handleUnitQtyChange = (index) => (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    setUnitRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, qty: digits } : r)),
    )
  }

  const handleReset = () => {
    setForm({
      barcode: '',
      productSearch: '',
      selectedProduct: '',
      remark: '',
    })
    setUnitRows([
      { unitType: 'Piece', qtyPerUnit: 1, qty: '' },
      { unitType: 'Case', qtyPerUnit: 12, qty: '' },
    ])
  }

  const selectedProduct = products.find((p) => p._id === form.selectedProduct) || null

  const filteredProducts = useMemo(() => {
    const query = form.productSearch.trim().toLowerCase()
    if (!query) return products
    return products.filter((p) => {
      const idMatch = p.productId?.toLowerCase().includes(query)
      const nameMatch = p.productName?.toLowerCase().includes(query)
      const barcodeMatch = (p.packings || []).some((pk) => {
        if (!pk.barcode) return false
        return String(pk.barcode).toLowerCase().includes(query)
      })
      return idMatch || nameMatch || barcodeMatch
    })
  }, [products, form.productSearch])

  const availablePieces = Number(
    selectedProduct && typeof selectedProduct.currentStock === 'number'
      ? selectedProduct.currentStock
      : 0,
  )
  const totalNewPieces = unitRows.reduce(
    (sum, r) => sum + (Number(r.qtyPerUnit) || 0) * (Number(r.qty) || 0),
    0,
  )
  const newStockPieces = totalNewPieces

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!selectedProduct) return

    if (!totalNewPieces && totalNewPieces !== 0) {
      // eslint-disable-next-line no-alert
      window.alert('Enter a quantity to set stock.')
      return
    }

    if (totalNewPieces < 0) {
      // eslint-disable-next-line no-alert
      window.alert('Stock cannot be negative.')
      return
    }

    if (!form.remark || form.remark.trim().length < 10) {
      // eslint-disable-next-line no-alert
      window.alert('Remark must be at least 10 characters.')
      return
    }

    setShowSecurityModal(true)
  }

  const handleSecurityConfirm = async () => {
    if (!selectedProduct) return
    const code = securityCode.trim()
    if (!code) {
      window.alert('Please enter the security code.')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/products/${selectedProduct._id}/stock-adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          newStockPieces,
          defaultUnitType: unitRows[0]?.unitType || 'Piece',
          defaultUnitQty: unitRows[0]?.qtyPerUnit || 1,
          remark: form.remark,
          securityCode: code,
        }),
      })

      const data = await res.json().catch(() => ({}))
      setShowSecurityModal(false)
      setSecurityCode('')

      if (!res.ok) {
        if (res.status === 403 && data.message === 'Access denied') {
          window.alert('Access denied.')
          return
        }
        throw new Error(data.message || 'Failed to update stock')
      }

      const updatedId = data._id != null ? String(data._id) : null
      setProducts((prev) =>
        prev.map((p) => (updatedId && String(p._id) === updatedId ? { ...p, ...data, stockHistory: data.stockHistory ?? p.stockHistory, currentStock: data.currentStock } : p)),
      )
      setForm((prev) => ({ ...prev, remark: '' }))
      setUnitRows((rows) =>
        rows.map((r) => ({ ...r, qty: '' })),
      )
    } catch (err) {
      window.alert(err.message || 'Failed to update stock')
    }
  }

  return (
    <>
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Stock Details</h5>
        </Card.Header>
        <Card.Body>
          <Row className="g-4">
            <Col md={6}>
              <Form onSubmit={handleSubmit}>
                <Row className="g-3">
                  <Col md={12}>
                    <Row className="align-items-center g-2">
                      <Col md={3}>
                        <Form.Label className="mb-0">Barcode</Form.Label>
                      </Col>
                      <Col md={9}>
                        <Form.Control
                          type="text"
                          placeholder="Enter Barcode"
                          maxLength={18}
                          value={form.barcode}
                          onChange={handleChange('barcode')}
                          onKeyDown={handleBarcodeKeyDown}
                        />
                      </Col>
                    </Row>
                  </Col>

                  <Col md={12}>
                    <Row className="align-items-center g-2">
                      <Col md={3}>
                        <Form.Label className="mb-0">
                          Product <span className="text-danger">*</span>
                        </Form.Label>
                      </Col>
                      <Col md={3}>
                        <Form.Control
                          type="text"
                          placeholder="Search"
                          value={form.productSearch}
                          onChange={handleChange('productSearch')}
                          onKeyDown={handleProductSearchKeyDown}
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Select
                          value={form.selectedProduct}
                          onChange={handleChange('selectedProduct')}
                        >
                          <option value="">Select</option>
                          {filteredProducts.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.productId} - {p.productName}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Col>

                  <Col md={12}>
                    <Row className="align-items-center g-2">
                      <Col md={3}>
                        <Form.Label className="mb-0">Current Stock (pieces)</Form.Label>
                      </Col>
                      <Col md={9}>
                        <Form.Control
                          type="text"
                          value={availablePieces}
                          readOnly
                        />
                      </Col>
                    </Row>
                  </Col>

                  <Col md={12}>
                    <Row className="align-items-center g-2">
                      <Col md={3}>
                        <Form.Label className="mb-0">
                          Remark <span className="text-danger">*</span>
                        </Form.Label>
                      </Col>
                      <Col md={9}>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          maxLength={250}
                          placeholder="Enter Remark"
                          value={form.remark}
                          onChange={handleChange('remark')}
                        />
                        <div className="small text-danger mt-1">
                          Note: Minimum of 10 characters required.
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Form>
            </Col>

            <Col md={6}>
              <Table
                bordered
                striped
                size="sm"
                className="mb-0"
                style={{ borderColor: '#e5e7eb' }}
              >
                <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                  <tr>
                    <th className="text-center">Unit Type</th>
                    <th className="text-center">Quantity Per Unit</th>
                    <th style={{ width: '5%' }} />
                    <th className="text-center">Quantity</th>
                    <th className="text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((row, index) => {
                    const rowTotal =
                      (Number(row.qtyPerUnit) || 0) * (Number(row.qty) || 0)
                    const isHighlighted = row.unitType !== 'Piece'
                    return (
                      <tr
                        key={row.unitType}
                        style={
                          isHighlighted
                            ? { backgroundColor: '#8cc896', fontWeight: 'bold' }
                            : undefined
                        }
                      >
                        <td className="text-center">{row.unitType}</td>
                        <td className="text-center">{row.qtyPerUnit}</td>
                        <td className="text-center">*</td>
                        <td className="text-center">
                          <Form.Control
                            type="text"
                            maxLength={6}
                            className="text-center"
                            value={row.qty}
                            onChange={handleUnitQtyChange(index)}
                          />
                        </td>
                        <td className="text-center">{rowTotal}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-end">
                      <strong>Total New Stock in Pieces</strong>
                    </td>
                    <td className="text-center">
                      <Form.Control
                        type="text"
                        disabled
                        className="text-center"
                        value={totalNewPieces}
                      />
                    </td>
                  </tr>
                </tfoot>
              </Table>
              <div className="mt-2 small text-muted text-end">
                New stock (pieces) after update: <strong>{newStockPieces}</strong>
              </div>
            </Col>
          </Row>
        </Card.Body>
        <Card.Footer className="py-2">
          <div className="d-flex justify-content-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              style={{ backgroundColor: '#F29F67', borderColor: '#F29F67' }}
              onClick={handleSubmit}
              disabled={!selectedProduct}
              title={!selectedProduct ? 'Select a product first' : 'Update stock'}
            >
              Update
            </Button>
          </div>
        </Card.Footer>
      </Card>

      <Modal show={showSecurityModal} onHide={() => { setShowSecurityModal(false); setSecurityCode('') }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Enter security code</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2 small text-muted">User type: <strong>{ROLE_LABELS[user?.role] || user?.role || 'User'}</strong></p>
          <Form.Group>
            <Form.Label className="small">Security code</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter your password"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSecurityConfirm())}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => { setShowSecurityModal(false); setSecurityCode('') }}>
            Cancel
          </Button>
          <Button
            size="sm"
            style={{ backgroundColor: '#F29F67', borderColor: '#F29F67' }}
            onClick={handleSecurityConfirm}
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span className="fw-semibold">Stock Update Log List - </span>
              <span className="fw-bold">
                {selectedProduct
                  ? `(${selectedProduct.productId} - ${selectedProduct.productName})`
                  : '(Select a product)'}
              </span>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="table-responsive mb-3">
            <Table bordered striped size="sm" className="mb-0">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  <th className="text-center" style={{ width: '10%' }}>
                    Date / Time
                  </th>
                  <th className="text-center" style={{ width: '7%' }}>
                    Before Stock
                    <br />
                    (In piece)
                  </th>
                  <th className="text-center" style={{ width: '7%' }}>
                    Affected Stock
                    <br />
                    (In piece)
                  </th>
                  <th className="text-center" style={{ width: '7%' }}>
                    Default Affected
                    <br />
                    Stock
                  </th>
                  <th className="text-center" style={{ width: '7%' }}>
                    Current Stock
                    <br />
                    (In piece)
                  </th>
                  <th className="text-center" style={{ width: '7%' }}>
                    Current Stock
                    <br />
                    In Default Unit
                  </th>
                  <th className="text-center" style={{ width: '8%' }}>
                    Reference ID
                  </th>
                  <th className="text-center" style={{ width: '10%' }}>
                    Updated By
                  </th>
                  <th className="text-center" style={{ width: '25%' }}>
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct?.stockHistory?.length ? (
                  [...selectedProduct.stockHistory].reverse().map((entry, idx) => {
                    const date = entry.at ? new Date(entry.at) : null
                    const dateStr = date
                      ? `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                      : ''
                    const defaultUnitLabel =
                      entry.defaultUnitType && entry.defaultUnitQty
                        ? `${entry.delta >= 0 ? '+' : ''}${(
                          (entry.delta || 0) / (entry.defaultUnitQty || 1)
                        ).toFixed(2)} ${entry.defaultUnitType}`
                        : ''
                    const currentDefaultLabel =
                      entry.defaultUnitType && entry.defaultUnitQty
                        ? `${(entry.newStock / entry.defaultUnitQty).toFixed(0)} ${
                          entry.defaultUnitType
                        }`
                        : ''
                    return (
                      <tr key={entry.at || idx}>
                        <td className="text-center">{dateStr}</td>
                        <td className="text-center">{entry.oldStock}</td>
                        <td className="text-center">
                          {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                        </td>
                        <td className="text-center">{defaultUnitLabel}</td>
                        <td className="text-center">{entry.newStock}</td>
                        <td className="text-center">{currentDefaultLabel}</td>
                        <td className="text-center">{entry.referenceId || '-'}</td>
                        <td className="text-center">{entry.userName || '-'}</td>
                        <td>
                          <p className="mb-0">{entry.remark}</p>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center text-muted">
                      {selectedProduct ? 'No stock updates yet.' : 'Select a product to see history.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <Row className="align-items-center g-2">
            <Col md={3} sm={5} className="small text-muted">
              <strong>
                Records:{' '}
                {selectedProduct?.stockHistory?.length
                  ? selectedProduct.stockHistory.length
                  : 0}
              </strong>
            </Col>
            <Col md={5} sm={7} className="small text-warning">
              <span>
                Note:{' '}
                <span
                  style={{
                    backgroundColor: '#FFEB99',
                    display: 'inline-block',
                    width: 40,
                    height: 12,
                  }}
                />{' '}
                Notify stock updated from modular.
              </span>
            </Col>
            <Col md={4} className="text-md-end small mt-2 mt-md-0 text-muted">
              Showing latest updates first.
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </>
  )
}

function ProductListTab() {
  return (
    <Card>
      <Card.Header as="h5">Product List</Card.Header>
      <Card.Body>
        <p className="text-muted mb-0">
          For the full searchable list, use the <a href="/products/list">Product List</a> screen in the sidebar.
        </p>
      </Card.Body>
    </Card>
  )
}

function InventoryDashboard() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    api
      .get('/api/products?limit=all&status=Active')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || 'Failed to load inventory overview')
        if (!alive) return
        setItems(Array.isArray(data.items) ? data.items : [])
      })
      .catch((e) => {
        if (!alive) return
        setError(e.message || 'Failed to load inventory overview')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  const stats = useMemo(() => {
    if (!items.length) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        totalPotentialValue: 0,
        lowReorderCount: 0,
        lowReorderItems: [],
      }
    }

    const totalProducts = items.length
    const activeProducts = items.filter((p) => p.isActive !== false).length
    const inactiveProducts = totalProducts - activeProducts

    const totalPotentialValue = items.reduce((sum, p) => {
      const srp = Number(p.srp || 0)
      return sum + (Number.isFinite(srp) ? srp : 0)
    }, 0)

    const lowReorderItems = items
      .filter((p) => typeof p.reorderMark === 'number' && p.reorderMark > 0)
      .slice(0, 10)

    const lowReorderCount = lowReorderItems.length

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalPotentialValue,
      lowReorderCount,
      lowReorderItems,
    }
  }, [items])

  const lowPercentage =
    stats.totalProducts > 0 ? Math.round((stats.lowReorderCount / stats.totalProducts) * 100) : 0

  return (
    <>
      <h2 className="mb-4">Inventory Dashboard</h2>

      {error && (
        <p className="text-danger small mb-3">
          {error}
        </p>
      )}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">Total Products</div>
              <div className="fs-3 fw-semibold">{stats.totalProducts.toLocaleString()}</div>
              <div className="small text-muted">
                {stats.activeProducts.toLocaleString()} active / {stats.inactiveProducts.toLocaleString()} inactive
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">Catalog SRP Value</div>
              <div className="fs-3 fw-semibold">
                $
                {stats.totalPotentialValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="small">Sum of SRP across active items</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="text-muted text-uppercase small mb-1">Items With Reorder Mark</div>
              <div className="fs-3 fw-semibold">{stats.lowReorderCount}</div>
              <ProgressBar
                now={lowPercentage}
                label={`${lowPercentage}% of catalog`}
                className="mt-2"
                style={{ height: 10, fontSize: 10 }}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card className="h-100">
            <Card.Header>Inventory snapshot</Card.Header>
            <Card.Body>
              <p className="text-muted small">
                This widget will later show real movement (sales vs purchases). For now it summarises your catalog using
                available stock-related fields.
              </p>
              <Row className="g-3 mt-1">
                <Col md={6}>
                  <Card bg="light" className="h-100">
                    <Card.Body>
                      <div className="text-muted text-uppercase small mb-1">Active items</div>
                      <div className="fs-4 fw-semibold">{stats.activeProducts.toLocaleString()}</div>
                      <div className="small text-success">
                        {(stats.totalProducts || 0) > 0
                          ? `${Math.round((stats.activeProducts / stats.totalProducts) * 100)}% of catalog`
                          : 'No products yet'}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card bg="light" className="h-100">
                    <Card.Body>
                      <div className="text-muted text-uppercase small mb-1">Reorder monitored</div>
                      <div className="fs-4 fw-semibold">{stats.lowReorderCount.toLocaleString()}</div>
                      <div className="small text-muted">Items with a Re-order Mark configured</div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>Quick actions</Card.Header>
            <Card.Body>
              <ul className="small mb-0">
                <li>Update on-hand quantities using the Stock Update tab.</li>
                <li>Review items with Re-order Marks below.</li>
                <li>Open the full Product List to filter by category, expiry, and more.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={12}>
          <Card className="h-100">
            <Card.Header>Items with Re-order Mark</Card.Header>
            <Card.Body className="p-0">
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th className="text-end">Re-order Mark (pcs)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowReorderItems.map((p) => (
                    <tr key={p._id}>
                      <td>{p.productId}</td>
                      <td>{p.productName}</td>
                      <td>{p.category}</td>
                      <td>{p.brand}</td>
                      <td className="text-end">{p.reorderMark}</td>
                      <td>
                        <Badge bg={p.isActive === false ? 'secondary' : 'success'}>
                          {p.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {stats.lowReorderItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        {loading ? 'Loading...' : 'No items with Re-order Mark yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}

function InventoryManagerPage() {
  return (
    <>
      <InventoryDashboard />
    </>
  )
}

export default InventoryManagerPage

