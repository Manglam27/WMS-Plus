import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/api'
import { useAuth } from '../../context/AuthContext'

const STATUS_OPTIONS = [
  'add-on',
  'add-on-packed',
  'cancelled',
  'close',
  'delivered',
  'new',
  'packed',
  'processed',
  'ready-to-ship',
  'shipped',
  'undelivered',
]

const SHIPPING_TYPE_OPTIONS = [
  'Customer Pickup',
  'Ground Shipping',
  'Sales Pickup',
  'Sales Quote - Customer Pickup',
  'Sales Quote - Ground Shipping',
  'Sales Quote - Sales Pickup',
  'Sales Quote - UPS COD/Check',
  'Sales Quote - UPS Regular',
  'UPS COD Cashier check/MO',
  'UPS COD Check',
  'UPS Regular',
]

function toLabel(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x))
    .join(' ')
}

function money(v) {
  return (Number(v) || 0).toFixed(2)
}

function ChipMultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  allValue = 'all',
  allLabel = 'All',
  bubbleClassName = '',
  allExclusive = false,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedSet = new Set(selectedValues || [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const toggleValue = (value) => {
    const current = new Set(selectedValues || [allValue])
    if (value === allValue) {
      onChange([allValue])
      return
    }
    if (allExclusive) {
      current.delete(allValue)
      if (current.has(value)) current.delete(value)
      else current.add(value)
      const next = Array.from(current).filter((v) => v !== allValue)
      onChange(next.length ? next : [allValue])
      return
    }
    current.add(allValue)
    if (current.has(value)) current.delete(value)
    else current.add(value)
    const next = Array.from(current)
    if (!next.includes(allValue)) next.unshift(allValue)
    onChange(next.length ? [...new Set(next)] : [allValue])
  }

  const removeChip = (value) => {
    if (value === allValue) return
    const current = new Set(selectedValues || [])
    current.delete(value)
    const next = Array.from(current).filter((v) => v !== allValue)
    if (allExclusive) {
      onChange(next.length ? next : [allValue])
      return
    }
    if (!next.includes(allValue)) next.unshift(allValue)
    onChange(next.length ? [...new Set(next)] : [allValue])
  }

  const displayValues = (selectedValues || []).map((v) => (v === allValue ? allLabel : toLabel(v)))

  return (
    <div className="chip-multi-select" ref={rootRef}>
      <Form.Label className="small mb-1">{label}</Form.Label>
      <button type="button" className="chip-multi-select-control" onClick={() => setOpen((s) => !s)}>
        <div className="chip-multi-select-bubbles">
          {displayValues.map((txt, idx) => {
            const raw = (selectedValues || [])[idx]
            return (
              <span key={`${raw}-${idx}`} className={`chip-multi-select-bubble ${bubbleClassName}`}>
                {txt}
                <span
                  className="chip-multi-select-bubble-x"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChip(raw)
                  }}
                >
                  ×
                </span>
              </span>
            )
          })}
        </div>
        <span className="chip-multi-select-caret">▾</span>
      </button>
      {open && (
        <div className="chip-multi-select-menu">
          <label className="chip-multi-select-item">
            <input
              type="checkbox"
              checked={selectedSet.has(allValue)}
              onChange={() => toggleValue(allValue)}
            />
            <span>{allLabel}</span>
          </label>
          {options.map((opt) => (
            <label key={opt} className="chip-multi-select-item">
              <input
                type="checkbox"
                checked={selectedSet.has(opt)}
                onChange={() => toggleValue(opt)}
              />
              <span>{toLabel(opt)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function OrdersListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSalesManager = user?.role === 'sales_manager'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState('10')
  const [currentPage, setCurrentPage] = useState(1)
  const [salesPeople, setSalesPeople] = useState([])
  const defaultStatuses = isSalesManager ? ['packed', 'add-on-packed'] : ['all']
  const initialFilters = {
    customer: '',
    orderNo: '',
    statuses: defaultStatuses,
    shippingTypes: ['all'],
    salesPeople: ['all'],
    driver: '',
    orderType: '',
    orderFromDate: '',
    orderToDate: '',
    deliveryFromDate: '',
    deliveryToDate: '',
    cancelFromDate: '',
    cancelToDate: '',
  }
  const [filtersDraft, setFiltersDraft] = useState(initialFilters)
  const [filtersApplied, setFiltersApplied] = useState(initialFilters)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [assignChoice, setAssignChoice] = useState('customer')
  const [printTemplate, setPrintTemplate] = useState('default')
  const [actionMessage, setActionMessage] = useState('')
  const [companySettings, setCompanySettings] = useState(null)

  useEffect(() => {
    api
      .get('/api/sales/orders')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (res.ok) setRows(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isSalesManager) return
    api
      .get('/api/sales/salespeople')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) return
        setSalesPeople(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [isSalesManager])

  useEffect(() => {
    api
      .get('/api/company-settings')
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (res.ok && data) setCompanySettings(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isSalesManager) return
    api
      .get('/api/sales/drivers')
      .then(async (res) => {
        const data = await res.json().catch(() => [])
        if (!res.ok) return
        setDrivers(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
  }, [isSalesManager])

  const badge = (s) => {
    if (s === 'draft') return { bg: 'warning', text: 'dark' }
    if (s === 'new') return { bg: 'primary' }
    if (s === 'packed' || s === 'add-on-packed') return { bg: 'success' }
    if (s === 'add-on' || s === 'ready-to-ship' || s === 'shipped') return { bg: 'info' }
    if (s === 'cancelled' || s === 'undelivered') return { bg: 'danger' }
    if (s === 'delivered' || s === 'close') return { bg: 'dark' }
    return { bg: 'secondary' }
  }

  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean).map((x) => String(x).trim()))]
    return {
      customers: uniq(rows.map((o) => o.customer?.customerName || o.customer?.businessName)),
      salesPeople: uniq(rows.map((o) => o.salesPerson?.name || o.salesPerson?.username)),
      statuses: uniq(rows.map((o) => o.status)),
      shippingTypes: uniq(rows.map((o) => o.shippingType)),
      customerTypes: uniq(rows.map((o) => o.customer?.customerType)),
      shippingStates: uniq(
        rows.map((o) => o.customer?.shippingAddress?.state || o.customer?.billingAddress?.state),
      ),
      orderTypes: uniq(rows.map((o) => o.orderType)),
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const isInDateRange = (dateValue, from, to) => {
      if (!from && !to) return true
      if (!dateValue) return false
      const d = new Date(dateValue)
      if (Number.isNaN(d.getTime())) return false
      if (from) {
        const start = new Date(from)
        if (!Number.isNaN(start.getTime()) && d < start) return false
      }
      if (to) {
        const end = new Date(to)
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999)
          if (d > end) return false
        }
      }
      return true
    }

    return rows.filter((o) => {
      const customerName = o.customer?.customerName || o.customer?.businessName || ''
      const salesPersonName = o.salesPerson?.name || o.salesPerson?.username || ''
      const orderNo = o.orderNumber || ''
      const status = o.status || ''
      const shippingType = o.shippingType || ''

      if (filtersApplied.customer && customerName !== filtersApplied.customer) return false
      if (filtersApplied.orderNo && !orderNo.toLowerCase().includes(filtersApplied.orderNo.toLowerCase())) return false
      const selectedStatuses = Array.isArray(filtersApplied.statuses) ? filtersApplied.statuses : []
      const statusHasAll = selectedStatuses.includes('all')
      const statusConstraints = selectedStatuses.filter((x) => x !== 'all')
      if (!statusHasAll && statusConstraints.length > 0 && !statusConstraints.includes(status)) return false
      const selectedShippingTypes = Array.isArray(filtersApplied.shippingTypes) ? filtersApplied.shippingTypes : []
      const shippingHasAll = selectedShippingTypes.includes('all')
      const shippingTypeConstraints = selectedShippingTypes.filter((x) => x !== 'all')
      if (!shippingHasAll && shippingTypeConstraints.length > 0 && !shippingTypeConstraints.includes(shippingType)) return false
      const selectedSalesPeople = Array.isArray(filtersApplied.salesPeople) ? filtersApplied.salesPeople : []
      const salesPeopleHasAll = selectedSalesPeople.includes('all')
      const salesPersonConstraints = selectedSalesPeople.filter((x) => x !== 'all')
      if (!salesPeopleHasAll && salesPersonConstraints.length > 0 && !salesPersonConstraints.includes(salesPersonName)) return false
      if (filtersApplied.orderType && (o.orderType || '') !== filtersApplied.orderType) return false
      if (!isInDateRange(o.orderDate || o.createdAt, filtersApplied.orderFromDate, filtersApplied.orderToDate)) return false
      if (!isInDateRange(o.deliveryDate, filtersApplied.deliveryFromDate, filtersApplied.deliveryToDate)) return false

      return true
    }).sort((a, b) => {
      const ao = String(a.orderNumber || '')
      const bo = String(b.orderNumber || '')
      const an = Number((ao.match(/\d+/g) || []).join('')) || 0
      const bn = Number((bo.match(/\d+/g) || []).join('')) || 0
      if (bn !== an) return bn - an
      return bo.localeCompare(ao)
    })
  }, [rows, filtersApplied])

  const pagedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows
    const size = Number(pageSize) || 10
    const start = (currentPage - 1) * size
    return filteredRows.slice(start, start + size)
  }, [filteredRows, pageSize, currentPage])

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1
    const size = Number(pageSize) || 10
    return Math.max(1, Math.ceil(filteredRows.length / size))
  }, [filteredRows.length, pageSize])

  const isViewOnlyStatus = (status) => ['shipped', 'delivered', 'undelivered', 'close', 'cancelled'].includes(String(status || ''))

  const getShippingRowClass = (shippingType) => {
    const raw = String(shippingType || '').toLowerCase()
    if (raw.includes('ups')) return 'order-row--shipping-ups'
    if (raw.includes('sales pickup')) return 'order-row--shipping-sales-pickup'
    if (raw.includes('customer pickup')) return 'order-row--shipping-customer-pickup'
    return ''
  }

  useEffect(() => {
    setSelectedOrderIds((prev) => prev.filter((id) => pagedRows.some((row) => row._id === id)))
  }, [pagedRows])

  const allPagedSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedOrderIds.includes(row._id))

  const toggleSelectAllPaged = () => {
    if (allPagedSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !pagedRows.some((row) => row._id === id)))
    } else {
      const ids = pagedRows.map((row) => row._id)
      setSelectedOrderIds((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const toggleOrderSelected = (orderId) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId)
      return [...prev, orderId]
    })
  }

  const openHistory = (order) => {
    setActiveOrder(order)
    setShowHistoryModal(true)
  }

  const openPrint = (order) => {
    setActiveOrder(order)
    setPrintTemplate('default')
    setShowPrintModal(true)
  }

  const printInvoiceFromList = () => {
    if (!activeOrder) return
    const orderNo = String(activeOrder.orderNumber || '')
    const invoiceTitle = printTemplate === 'sales_quote' ? 'Sales Quote Invoice' : 'Invoice'
    const companyName = String(companySettings?.companyName || 'Your Company').trim()
    const companyLogo = companySettings?.logoFileName
      ? `/api/uploads/company/${companySettings.logoFileName}`
      : ''
    const companyAddress = [
      companySettings?.addressLine1,
      companySettings?.addressLine2,
      [companySettings?.city, companySettings?.state, companySettings?.zipCode].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n')
    const taxLabel = String(companySettings?.salesTaxLabel || 'Sales Tax').trim() || 'Sales Tax'
    const footerDisclosure = String(companySettings?.invoiceDisclosure || '').trim()
    const footerTerms = String(companySettings?.invoiceTerms || activeOrder.terms || '').trim()

    const groupedByCategory = (activeOrder.lineItems || []).reduce((acc, item) => {
      const category = String(
        item?.baseCategory || item?.category || item?.categoryName || item?.productCategory || 'Uncategorized',
      ).trim() || 'Uncategorized'
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {})
    const categorySections = Object.entries(groupedByCategory)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([category, items]) => {
        const rows = [...items]
          .sort((a, b) => {
            const nameA = String(a?.productName || '').trim()
            const nameB = String(b?.productName || '').trim()
            const byName = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
            if (byName !== 0) return byName
            const idA = String(a?.productId || '').trim()
            const idB = String(b?.productId || '').trim()
            return idA.localeCompare(idB, undefined, { sensitivity: 'base' })
          })
          .map(
            (l) => `
              <tr>
                <td>${l.productId || ''}</td>
                <td>${l.productName || ''}</td>
                <td>${l.unitType || ''}</td>
                <td style="text-align:right;">${Number(l.qty || 0)}</td>
                <td style="text-align:right;">${money(l.srp)}</td>
                <td style="text-align:right;">${money(l.unitPrice)}</td>
                <td style="text-align:right;">${money(l.netPrice)}</td>
              </tr>
            `,
          )
          .join('')
        const categoryTotal = items.reduce((sum, l) => sum + (Number(l.netPrice) || 0), 0)
        return `
          <div class="category-block">
            <div class="category-title">${category}</div>
            <table>
              <colgroup>
                <col style="width: 12%;" />
                <col style="width: 32%;" />
                <col style="width: 10%;" />
                <col style="width: 8%;" />
                <col style="width: 12%;" />
                <col style="width: 13%;" />
                <col style="width: 13%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product</th>
                  <th>Unit</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">SRP</th>
                  <th style="text-align:right;">Unit Price</th>
                  <th style="text-align:right;">Net Price</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="category-total"><strong>${category} Subtotal:</strong> $ ${money(categoryTotal)}</div>
          </div>
        `
      })
      .join('')

    const w = window.open('', '_blank', 'width=1000,height=860')
    if (!w) return
    w.document.write(`
      <html>
        <head>
          <title>${invoiceTitle} - ${orderNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #0f172a; background: #fff; }
            .sheet { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
            .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:8px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
            .head h3 { margin:0; color: #1e293b; }
            .invoice-code { font-size: 13px; color: #334155; margin-top: 6px; }
            .meta { border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; padding:10px 12px; margin-bottom:14px; line-height:1.45; font-size:14px; display:grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
            .category-block { margin-bottom: 14px; }
            .category-title { background: #e2e8f0; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700; font-size: 13px; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; }
            table { width:100%; border-collapse:collapse; font-size:13px; table-layout: fixed; }
            th { background:#1e293b; color:#fff; border:1px solid #334155; text-align:left; padding:8px; }
            td { border:1px solid #cbd5e1; padding:7px 8px; vertical-align:top; overflow-wrap:anywhere; }
            .category-total { text-align:right; margin-top: 6px; font-size: 13px; }
            .totals { margin-top:12px; text-align:right; font-size:14px; }
            .totals div { margin-bottom:4px; }
            .footer-notes { margin-top: 16px; border-top: 1px dashed #94a3b8; padding-top: 12px; display:grid; grid-template-columns: 1fr; gap: 10px; font-size: 12px; }
            .note-card { border:1px solid #cbd5e1; border-radius:8px; padding:10px; background:#fafafa; break-inside: avoid; page-break-inside: avoid; }
            .note-title { font-weight:700; margin-bottom:5px; color:#0f172a; }
            .note-body { white-space: pre-wrap; line-height: 1.5; color:#334155; overflow-wrap: anywhere; word-break: break-word; hyphens: auto; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                ${companyLogo ? `<img src="${companyLogo}" alt="" style="max-height:56px;max-width:180px;object-fit:contain;margin-bottom:8px;" />` : ''}
                <div style="font-size:20px;font-weight:700;line-height:1.2;margin-bottom:2px;">${companyName}</div>
                ${companyAddress ? `<div style="white-space:pre-wrap;font-size:12px;color:#334155;margin-bottom:6px;">${companyAddress}</div>` : ''}
                <h3>${invoiceTitle}</h3>
                <div class="invoice-code">Invoice No: ${orderNo}</div>
              </div>
              <div style="text-align:right; font-size:12px; color:#334155;">
                <div><strong>Date:</strong> ${activeOrder.orderDate ? new Date(activeOrder.orderDate).toLocaleDateString() : '—'}</div>
                <div><strong>Delivery:</strong> ${activeOrder.deliveryDate ? new Date(activeOrder.deliveryDate).toLocaleDateString() : '—'}</div>
              </div>
            </div>
            <div class="meta">
              <div><strong>Customer:</strong> ${activeOrder.customer?.customerName || activeOrder.customer?.businessName || ''}</div>
              <div><strong>Sales Person:</strong> ${activeOrder.salesPerson?.name || activeOrder.salesPerson?.username || ''}</div>
              <div><strong>Shipping Type:</strong> ${activeOrder.shippingType || '-'}</div>
              <div><strong>Tax:</strong> ${taxLabel}</div>
              <div style="grid-column:1 / span 2;"><strong>Shipping Address:</strong> ${activeOrder.shippingAddress || '-'}</div>
            </div>
            ${categorySections}
            <div class="totals">
              <div><strong>Subtotal:</strong> $ ${money(activeOrder.subtotal)}</div>
              <div><strong>Shipping:</strong> $ ${money(activeOrder.shippingCharges)}</div>
              <div><strong>${taxLabel}:</strong> $ ${money(activeOrder.totalTax)}</div>
              <div><strong>Grand Total:</strong> $ ${money(activeOrder.orderTotal)}</div>
            </div>
            <div class="footer-notes">
              <div class="note-card">
                <div class="note-title">Disclosure</div>
                <div class="note-body">${footerDisclosure || '-'}</div>
              </div>
              <div class="note-card">
                <div class="note-title">Terms</div>
                <div class="note-body">${footerTerms || '-'}</div>
              </div>
            </div>
          </div>
          <script>
            window.addEventListener('load', () => {
              requestAnimationFrame(() => setTimeout(() => { window.focus(); window.print(); }, 100));
            });
          </script>
        </body>
      </html>
    `)
    w.document.close()
    setShowPrintModal(false)
  }

  const openAssignDriver = (order) => {
    setActiveOrder(order)
    setAssignChoice(order.assignedDriver?._id || 'customer')
    setShowAssignModal(true)
  }

  const performAssignDriver = async () => {
    if (!activeOrder) return
    setActionMessage('')
    if (!assignChoice) {
      setActionMessage('Select assignment option.')
      return
    }
    const isCustomer = assignChoice === 'customer'
    const isSalesPerson = assignChoice === 'sales_person'
    const isUpsDriver = assignChoice === 'ups_driver'
    const payload = isCustomer
      ? { action: 'assign_driver', assignTarget: 'customer' }
      : isSalesPerson
        ? { action: 'assign_driver', assignTarget: 'sales_person' }
        : isUpsDriver
          ? { action: 'assign_driver', assignTarget: 'ups_driver' }
          : { action: 'assign_driver', assignTarget: 'driver', driverId: assignChoice }
    const res = await api.patch(`/api/sales/orders/${activeOrder._id}/workflow`, payload)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setActionMessage(data.message || 'Failed to assign order.')
      return
    }
    setRows((prev) => prev.map((row) => (row._id === data._id ? data : row)))
    setShowAssignModal(false)
  }

  const historyRows = useMemo(() => {
    if (!activeOrder) return []
    const rawLogs = Array.isArray(activeOrder.logs) ? activeOrder.logs : []
    if (rawLogs.length > 0) {
      return rawLogs
        .map((log, i) => ({
          id: `${log.at || i}-${log.action || i}`,
          action: log.action || 'Action',
          by: log.byUserName || 'User',
          at: log.at ? new Date(log.at).getTime() : 0,
          atLabel: log.at ? new Date(log.at).toLocaleString() : '—',
        }))
        .sort((a, b) => b.at - a.at)
    }
    const events = [
      { title: 'Order created', when: activeOrder.createdAt },
      { title: 'Packed', when: activeOrder.packedAt },
      { title: 'Shipped', when: activeOrder.shippedAt },
      { title: 'Delivered / Undelivered', when: activeOrder.deliveredAt },
      { title: 'Cancelled', when: activeOrder.cancelledAt },
      { title: 'Closed', when: activeOrder.closedAt },
    ]
    return events
      .filter((e) => e.when)
      .map((e, i) => ({ id: `${e.title}-${i}`, action: e.title, by: 'System', atLabel: new Date(e.when).toLocaleString() }))
  }, [activeOrder])

  return (
    <div className="sales-tablet-page sales-orders-list-page">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="mb-0">{isSalesManager ? 'All Orders' : 'Order list'}</h2>
        {!isSalesManager && (
          <Link to="/sales/orders/new" className="btn btn-sm" style={{ backgroundColor: '#F29F67', borderColor: '#F29F67', color: '#1E1E2C' }}>
            New order
          </Link>
        )}
      </div>
      {isSalesManager && <div className="small text-muted mb-3">Home / Orders / Order List</div>}

      {isSalesManager && (
        <Card className="mb-3">
          <Card.Body className="py-2">
            <Row className="g-2 sales-orders-filters">
              <Col md={2}>
                <Form.Label className="small mb-1">All Customer</Form.Label>
                <Form.Select size="sm" value={filtersDraft.customer} onChange={(e) => setFiltersDraft((s) => ({ ...s, customer: e.target.value }))}>
                  <option value="">All Customer</option>
                  {options.customers.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Order Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.orderFromDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderFromDate: e.target.value }))}
                  placeholder="Order From Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Order Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.orderToDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderToDate: e.target.value }))}
                  placeholder="Order To Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">Order No</Form.Label>
                <Form.Control size="sm" value={filtersDraft.orderNo} onChange={(e) => setFiltersDraft((s) => ({ ...s, orderNo: e.target.value }))} placeholder="Order No" />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Delivery Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.deliveryFromDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, deliveryFromDate: e.target.value }))}
                  placeholder="Delivery From Date"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Delivery Date</Form.Label>
                <Form.Control
                  size="sm"
                  type="date"
                  value={filtersDraft.deliveryToDate}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, deliveryToDate: e.target.value }))}
                  placeholder="Delivery To Date"
                />
              </Col>

              <Col md={2}>
                <ChipMultiSelect
                  label="All Sales Person"
                  options={salesPeople.map((sp) => sp?.name || sp?.username || '').filter(Boolean)}
                  selectedValues={filtersDraft.salesPeople}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, salesPeople: vals }))}
                  allLabel="All Sales Person"
                  bubbleClassName="chip-multi-select-bubble--sales"
                />
              </Col>
              <Col md={2}>
                <ChipMultiSelect
                  label="All Status"
                  options={STATUS_OPTIONS}
                  selectedValues={filtersDraft.statuses}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, statuses: vals }))}
                  allLabel="All Status"
                  bubbleClassName="chip-multi-select-bubble--status"
                  allExclusive
                />
              </Col>
              <Col md={2}>
                <ChipMultiSelect
                  label="All Shipping Type"
                  options={SHIPPING_TYPE_OPTIONS}
                  selectedValues={filtersDraft.shippingTypes}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, shippingTypes: vals }))}
                  allLabel="All Shipping Type"
                  bubbleClassName="chip-multi-select-bubble--sales"
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">All Driver</Form.Label>
                <Form.Select size="sm" value={filtersDraft.driver} onChange={(e) => setFiltersDraft((s) => ({ ...s, driver: e.target.value }))}>
                  <option value="">All Driver</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">All Order Type</Form.Label>
                <Form.Select size="sm" value={filtersDraft.orderType} onChange={(e) => setFiltersDraft((s) => ({ ...s, orderType: e.target.value }))}>
                  <option value="">All Order Type</option>
                  {options.orderTypes.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">From Cancel Date</Form.Label>
                <Form.Control size="sm" type="date" value={filtersDraft.cancelFromDate} onChange={(e) => setFiltersDraft((s) => ({ ...s, cancelFromDate: e.target.value }))} />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">To Cancel Date</Form.Label>
                <Form.Control size="sm" type="date" value={filtersDraft.cancelToDate} onChange={(e) => setFiltersDraft((s) => ({ ...s, cancelToDate: e.target.value }))} />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">&nbsp;</Form.Label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary w-100"
                  onClick={() => {
                    setFiltersApplied({ ...filtersDraft })
                    setCurrentPage(1)
                  }}
                >
                  Search
                </button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
      {!isSalesManager && (
        <Card className="mb-3">
          <Card.Body className="py-2">
            <Row className="g-2">
              <Col md={4}>
                <Form.Label className="small mb-1">Order No</Form.Label>
                <Form.Control
                  size="sm"
                  value={filtersDraft.orderNo}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, orderNo: e.target.value }))}
                  placeholder="Search order no"
                />
              </Col>
              <Col md={4}>
                <Form.Label className="small mb-1">Customer</Form.Label>
                <Form.Select
                  size="sm"
                  value={filtersDraft.customer}
                  onChange={(e) => setFiltersDraft((s) => ({ ...s, customer: e.target.value }))}
                >
                  <option value="">All Customer</option>
                  {options.customers.map((v) => <option key={v} value={v}>{v}</option>)}
                </Form.Select>
              </Col>
              <Col md={4}>
                <ChipMultiSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  selectedValues={filtersDraft.statuses}
                  onChange={(vals) => setFiltersDraft((s) => ({ ...s, statuses: vals }))}
                  allLabel="All Status"
                  bubbleClassName="chip-multi-select-bubble--status"
                  allExclusive
                />
              </Col>
              <Col md={2}>
                <Form.Label className="small mb-1">&nbsp;</Form.Label>
                <Button
                  size="sm"
                  className="w-100"
                  onClick={() => {
                    setFiltersApplied({ ...filtersDraft })
                    setCurrentPage(1)
                  }}
                >
                  Search
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <p className="p-3 mb-0">Loading…</p>
          ) : (
            <Table responsive hover className="mb-0" size="sm">
              <thead style={{ backgroundColor: '#1E1E2C', color: '#fff' }}>
                <tr>
                  {!isSalesManager && <th>Action</th>}
                  {isSalesManager && (
                    <th>
                      <Form.Check
                        type="checkbox"
                        checked={allPagedSelected}
                        onChange={toggleSelectAllPaged}
                        title="Select all rows"
                      />
                    </th>
                  )}
                  <th>Status</th>
                  <th>Order No</th>
                  <th>Order Date</th>
                  <th>Sales Person</th>
                  <th>Customer</th>
                  <th className="text-end">Payable ($)</th>
                  <th className="text-end">Products</th>
                  {!isSalesManager && <th>Barcode</th>}
                  <th className="text-end">Packed Boxes</th>
                  {isSalesManager && <th className="text-end">Credit Memo</th>}
                  <th>Shipping Type</th>
                  {isSalesManager && <th>Sales Remark</th>}
                  {isSalesManager && <th>Driver Remarks</th>}
                  <th>Delivery Date</th>
                  {isSalesManager && <th>Canceled Date</th>}
                  {isSalesManager && <th>Canceled Remark</th>}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((o) => {
                  const b = badge(o.status)
                  const barcodes = [...new Set(
                    (o.lineItems || [])
                      .map((li) => String(li?.barcode || '').trim())
                      .filter(Boolean),
                  )]
                  const barcodeLabel = barcodes.length > 1 ? `${barcodes[0]} +${barcodes.length - 1}` : (barcodes[0] || '—')
                  return (
                    <tr key={o._id} className={getShippingRowClass(o.shippingType)}>
                      {!isSalesManager && (
                        <td>
                          {isViewOnlyStatus(o.status) ? (
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="View order"
                              onClick={() => navigate(`/sales/orders/${o._id}`)}
                            >
                              👁
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="Edit order"
                              onClick={() => navigate(`/sales/orders/new?edit=${o._id}`)}
                            >
                              ✏
                            </button>
                          )}
                        </td>
                      )}
                      {isSalesManager && (
                        <td>
                          <div className="orders-action-cell">
                            <Form.Check
                              type="checkbox"
                              checked={selectedOrderIds.includes(o._id)}
                              onChange={() => toggleOrderSelected(o._id)}
                            />
                            <button type="button" className="orders-icon-btn" title="Open order" onClick={() => navigate(`/sales/orders/${o._id}`)}>👁</button>
                            <button type="button" className="orders-icon-btn" title="History log" onClick={() => openHistory(o)}>🕘</button>
                            <button type="button" className="orders-icon-btn" title="Print templates" onClick={() => openPrint(o)}>🖨</button>
                            <button
                              type="button"
                              className="orders-icon-btn"
                              title="Assign to driver"
                              onClick={() => openAssignDriver(o)}
                              disabled={!['packed', 'add-on-packed'].includes(o.status)}
                            >
                              🚚
                            </button>
                          </div>
                        </td>
                      )}
                      <td><Badge bg={b.bg} text={b.text}>{o.status || 'new'}</Badge></td>
                      <td>{o.orderNumber}</td>
                      <td className="small text-muted">{o.orderDate ? new Date(o.orderDate).toLocaleDateString() : '—'}</td>
                      <td>{o.salesPerson?.name || o.salesPerson?.username || '—'}</td>
                      <td>{o.customer?.customerName || o.customer?.businessName || '—'}</td>
                      <td className="text-end">{Number(o.orderTotal || o.subtotal || 0).toFixed(2)}</td>
                      <td className="text-end">{Array.isArray(o.lineItems) ? o.lineItems.length : 0}</td>
                      {!isSalesManager && <td>{barcodeLabel}</td>}
                      <td className="text-end">{Math.max(1, Number(o.noOfPackedBoxes) || 1)}</td>
                      {isSalesManager && <td className="text-end">0</td>}
                      <td>{o.shippingType || '—'}</td>
                      {isSalesManager && <td>{o.salesPersonRemark || ''}</td>}
                      {isSalesManager && <td>{o.driverRemark || ''}</td>}
                      <td className="small text-muted">{o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—'}</td>
                      {isSalesManager && <td className="small text-muted">—</td>}
                      {isSalesManager && <td className="small text-muted">—</td>}
                    </tr>
                  )
                })}
                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={isSalesManager ? 16 : 12} className="text-center text-muted py-4">No orders found.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      {!loading && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="small text-muted">
            Records {filteredRows.length === 0 ? 0 : pageSize === 'all' ? 1 : (currentPage - 1) * (Number(pageSize) || 10) + 1}
            {' '} - {pageSize === 'all' ? filteredRows.length : Math.min(currentPage * (Number(pageSize) || 10), filteredRows.length)}
            {' '} of {filteredRows.length}
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="small text-muted">Rows:</div>
            {['10', '50', '100', 'all'].map((size) => (
              <button
                key={size}
                type="button"
                className={`btn btn-sm ${pageSize === size ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
              >
                {size === 'all' ? 'All' : size}
              </button>
            ))}
            {pageSize !== 'all' && (
              <div className="d-flex align-items-center gap-1">
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                  &lt;
                </button>
                <span className="small px-1">{currentPage} / {totalPages}</span>
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                  &gt;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Order History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!activeOrder ? (
            <div className="text-muted">No order selected.</div>
          ) : (
            <>
              <div className="small mb-2"><strong>Order:</strong> {activeOrder.orderNumber || '—'}</div>
              {historyRows.length === 0 ? (
                <div className="text-muted">No history logs yet.</div>
              ) : (
                <Table bordered size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>User</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h) => (
                      <tr key={h.id}>
                        <td>{h.action}</td>
                        <td>{h.by}</td>
                        <td>{h.atLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Print Templates</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="small mb-2">Choose invoice template</div>
          <Form.Check
            type="radio"
            id="tpl-default"
            name="print-template"
            label="Default Template"
            checked={printTemplate === 'default'}
            onChange={() => setPrintTemplate('default')}
          />
          <Form.Check
            type="radio"
            id="tpl-sales-quote"
            name="print-template"
            label="Sales Quote Invoice"
            checked={printTemplate === 'sales_quote'}
            onChange={() => setPrintTemplate('sales_quote')}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPrintModal(false)}>Close</Button>
          <Button
            variant="primary"
            onClick={printInvoiceFromList}
          >
            Print
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Check
            type="radio"
            id="assign-sales-person"
            name="assign-driver"
            label={<span className="fw-bold text-primary">Sales Person: {activeOrder?.salesPerson?.name || activeOrder?.salesPerson?.username || 'Sales Person'}</span>}
            checked={assignChoice === 'sales_person'}
            onChange={() => setAssignChoice('sales_person')}
          />
          <Form.Check
            type="radio"
            id="assign-customer-pickup"
            name="assign-driver"
            label="Customer Pickup"
            checked={assignChoice === 'customer'}
            onChange={() => setAssignChoice('customer')}
          />
          <hr className="my-2" />
          {drivers.map((d) => (
            <Form.Check
              key={d._id}
              type="radio"
              id={`drv-${d._id}`}
              name="assign-driver"
              label={d.name || d.username}
              checked={assignChoice === d._id}
              onChange={() => setAssignChoice(d._id)}
            />
          ))}
          <Form.Check
            type="radio"
            id="assign-ups-driver"
            name="assign-driver"
            label="UPS Driver"
            checked={assignChoice === 'ups_driver'}
            onChange={() => setAssignChoice('ups_driver')}
          />
          {actionMessage && <div className="text-danger small mt-2">{actionMessage}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Close</Button>
          <Button variant="primary" onClick={performAssignDriver}>Assign</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default OrdersListPage
