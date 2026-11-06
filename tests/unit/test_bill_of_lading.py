"""The Bill of Lading: its text from settings, the move's details filled in, the customer's signature where marked."""
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from company_documents import bill_of_lading_body, clean_html, fill_move_fields, resolve_parameters
from estimate_pdf import build_bill_of_lading_pdf
from models import Company

VALUES = {'customer_name': 'Pat Customer', 'customer_phone': '2405550100', 'pickup_address': '1 Origin St', 'delivery_address': '2 Destination Ave',
          'pickup_date': '2026-10-31', 'first_available_delivery_date': '2026-12-31', 'order_number': '28288-1',
          'total_estimate': '$11,426.35', 'minimum_cuft': '286 cu ft', 'minimum_charge': '$1,875.00', 'services_ordered': 'Storage'}


def documents():
    company = Company(name='Gorilla Haulers LLC', phone='(301) 747-5811', office_address='19960 Wild Cherry Ln', dot_number='3467429')
    body, missing = resolve_parameters(bill_of_lading_body(), company, html=True)
    assert missing == []
    return [{'title': 'Interstate Bill of Lading Contract', 'body_html': clean_html(fill_move_fields(body, VALUES))}]


def text_of(pdf):
    import pymupdf
    return ' '.join(' '.join(page.get_text().split()) for page in pymupdf.open(stream=pdf, filetype='pdf'))


def test_move_details_and_company_details_are_filled():
    body = documents()[0]['body_html']
    # Only the signature spots stay as marks, for the PDF to place.
    assert set(re.findall(r'\{\{[^}]+\}\}', body)) == {'{{customer_signature}}'}
    text = text_of(build_bill_of_lading_pdf({'name': 'Gorilla Haulers LLC'}, documents()))
    for value in ('Gorilla Haulers LLC', 'USDOT No.: 3467429', 'Order No.: 28288-1', 'Name: Pat Customer', 'Address: 1 Origin St',
                  'Address: 2 Destination Ave', 'Total Estimated Charges: $11,426.35', 'Minimum Cu.Ft.: 286 cu ft',
                  'Total Minimum Charge: $1,875.00', 'SECTION 19'):
        assert value in text, value
    assert text.count('Interstate Bill of Lading Contract') == 1


def test_each_signature_spot_shows_the_signature_once_signed():
    unsigned = text_of(build_bill_of_lading_pdf({'name': 'Co'}, documents()))
    assert unsigned.count('Name and date are added when you sign.') == 2
    signature = {'name': 'Pat Customer', 'signed_at': '2026-11-06T15:00:00Z', 'strokes': [[[0.1, 0.5], [0.9, 0.6]]]}
    signed = text_of(build_bill_of_lading_pdf({'name': 'Co'}, documents(), signature))
    assert signed.count('Signed: 2026-11-06T15:00:00Z') == 2 and 'Name and date are added' not in signed
