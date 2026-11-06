"""The Bill of Lading: the company's form filled from the signed estimate, the terms from settings on the back,
and the customer's signature and date on both signature lines."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from bill_of_lading_pdf import build_bill_of_lading_pdf
from company_documents import bill_of_lading_body, clean_html, resolve_parameters
from models import Company

COMPANY = {'name': 'Gorilla Haulers LLC', 'office_address': '19960 Wild Cherry Ln, Germantown, MD 20874', 'phone': '(301) 747-5811',
           'dot_number': '3467429'}
VALUES = {'mc_number': '1654219', 'order_number': '28288-1', 'pickup_date': '2026-10-31', 'first_available_delivery_date': '2026-12-31',
          'customer_name': 'Pat Customer', 'customer_phone': '2405550100', 'pickup_address': '1 Origin St, Clarksville, MD 21029',
          'delivery_address': '2 Destination Ave, San Antonio, TX 78253', 'total_estimate': '$5,561.79', 'minimum_cuft': '286 cu ft',
          'minimum_charge': '$1,875.00', 'service_names': ['Storage', 'Delivery shuttle']}
SIGNATURE = {'name': 'Pat Customer', 'signed_at': '2026-11-06T15:00:00Z', 'date': '11/06/2026', 'strokes': [[[0.1, 0.5], [0.9, 0.6]]]}


def terms():
    company = Company(name='Gorilla Haulers LLC', phone='(301) 747-5811')
    body, missing = resolve_parameters(bill_of_lading_body(), company, html=True)
    assert missing == []
    return [{'title': 'Interstate Bill of Lading Contract', 'body_html': clean_html(body)}]


def pages(pdf):
    import pymupdf
    return [' '.join(page.get_text().split()) for page in pymupdf.open(stream=pdf, filetype='pdf')]


def test_front_is_the_form_filled_from_the_estimate():
    front, back = pages(build_bill_of_lading_pdf(COMPANY, VALUES, terms()))
    for value in ('INTERSTATE BILL OF LADING CONTRACT', 'Gorilla Haulers LLC', 'Phone Number: (301) 747-5811', 'USDOT No.: 3467429',
                  'ICC/MC No.: 1654219', 'Order No.: 28288-1', 'Pick Up Date: 2026-10-31', '2026-12-31', 'NAME: Pat Customer',
                  'ADDRESS: 1 Origin St', 'CITY/STATE/ZIP: Clarksville, MD 21029', 'ADDRESS: 2 Destination Ave',
                  'TOTAL ESTIMATED CHARGES:', '$5,561.79', '286 cu ft', '$1,875.00', 'SUMMARY OF ACTUAL CHARGES', 'DELIVERY ACKNOWLEDGEMENT'):
        assert value in front, value
    # The back: the terms from settings, starting at SECTION 1.
    assert back.startswith('SECTION 1: Liability of Gorilla Haulers LLC') and 'SECTION 19' in back


def test_signature_date_goes_on_both_lines_once_signed():
    unsigned = pages(build_bill_of_lading_pdf(COMPANY, VALUES, terms()))[0]
    signed = pages(build_bill_of_lading_pdf(COMPANY, VALUES, terms(), SIGNATURE))[0]
    assert '11/06/2026' not in unsigned
    assert signed.count('11/06/2026') == 2
