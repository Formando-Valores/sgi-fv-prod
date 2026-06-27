"""Generate self-signed certificate for HTTPS development.
Usage: python gen_cert.py [IP1 IP2 ...]
Example: python gen_cert.py 192.168.1.12
"""
import datetime
import ipaddress
import sys
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())

subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, u'BR'),
    x509.NameAttribute(NameOID.COMMON_NAME, u'TaskFlow Dev'),
])

now = datetime.datetime.now(datetime.timezone.utc)

sans = [x509.DNSName(u'localhost'), x509.IPAddress(ipaddress.IPv4Address('127.0.0.1'))]

for ip_str in sys.argv[1:]:
    try:
        sans.append(x509.IPAddress(ipaddress.IPv4Address(ip_str)))
        print(f'  + Added IP: {ip_str}')
    except ValueError:
        print(f'  ! Invalid IP: {ip_str}')

san = x509.SubjectAlternativeName(sans)

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + datetime.timedelta(days=365 * 5))
    .add_extension(san, critical=False)
    .sign(key, hashes.SHA256(), backend=default_backend())
)

with open('key.pem', 'wb') as f:
    f.write(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))

with open('cert.pem', 'wb') as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print('OK: cert.pem + key.pem generated')
