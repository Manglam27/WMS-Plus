import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../api/api'

function pickPacking(product, unitType) {
  const packings = Array.isArray(product?.packings) ? product.packings : []
  return packings.find((p) => p.unitType === unitType) || null
}

function normalizeBarcode(value) {
  const s = String(value || '').trim()
  return s || ''
}

function ProductLabelPrintPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState('')

  const packings = useMemo(() => {
    const all = Array.isArray(product?.packings) ? product.packings : []
    const enabled = all.filter((p) => p.enabled !== false)
    if (enabled.length > 0) return enabled
    return all
  }, [product])

  useEffect(() => {
    let alive = true
    setError('')
    api
      .get(`/api/products/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || 'Failed to load product')
        if (!alive) return
        setProduct(data)
      })
      .catch((e) => alive && setError(e.message || 'Failed to load product'))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    const render = async () => {
      const list = Array.isArray(packings) ? packings : []
      // Draw QR for each active packing row
      // IDs will be qr-0, qr-1, ...
      for (let i = 0; i < list.length; i += 1) {
        const barcode = normalizeBarcode(list[i].barcode)
        if (!barcode) continue
        const canvas = document.getElementById(`qr-${i}`)
        if (canvas) {
          // eslint-disable-next-line no-await-in-loop
          await QRCode.toCanvas(canvas, barcode, { width: 70, margin: 1 })
        }
      }
    }

    if (product) {
      render().catch(() => {})
    }
  }, [packings, product])

  useEffect(() => {
    // Auto-trigger print once content is loaded
    if (!product) return
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [product])

  if (error) return <div style={{ padding: 16 }}>{error}</div>
  if (!product) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <div style={{ margin: 0 }}>
      <style>{`
        @page { size: 6in 4in; margin: 0; }
        html, body { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; }
        .label-wrap { width: 6in; height: 4in; padding: 0; box-sizing: border-box; }
        .tbl { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
        .tbl td { border: 1px solid #000; }
        .top { text-align: center; vertical-align: middle; padding: 18px 14px; word-break: break-word; }
        .pid { font-size: 60px; font-weight: 800; line-height: 1; margin: 0; }
        .pname { font-size: 32px; font-weight: 600; margin: 10px 0 0; }
        .qrCell { text-align: center; vertical-align: middle; padding: 10px; }
        .codeText { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 14px; margin-top: 4px; }
        .unit { font-size: 18px; font-weight: 700; margin: 4px 0 0; }
        .muted { font-size: 11px; color: #444; margin-top: 6px; }
      `}</style>

      <center>
        <div className="label-wrap">
          <table className="tbl" id="tblProduct">
            <tbody>
              <tr>
                <td colSpan={packings.length || 1} className="top">
                  <div className="pid">{product.productId}</div>
                  <div className="pname">{product.productName}</div>
                  {packings.some((p) => normalizeBarcode(p.barcode)) ? null : (
                    <div className="muted">Add barcodes in Packing Details to print QR codes.</div>
                  )}
                </td>
              </tr>
              <tr>
                {packings.map((p, index) => {
                  const barcode = normalizeBarcode(p.barcode)
                  return (
                    <td key={p.unitType || index} className="qrCell">
                      <div>
                        <canvas id={`qr-${index}`} />
                      </div>
                      <div className="codeText">{barcode || '—'}</div>
                      <div className="unit">{p.unitType || ''}</div>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </center>
    </div>
  )
}

export default ProductLabelPrintPage

