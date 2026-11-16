import pytest

from app.core.rate_limit import address_key


@pytest.mark.parametrize(
    ("address", "key"),
    [
        ("203.0.113.7", "203.0.113.7"),  # IPv4 is used as it is
        ("2001:db8:1:2::1", "2001:db8:1:2::/64"),  # IPv6 is keyed on its /64 network
        ("2001:DB8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64"),
        ("::ffff:203.0.113.7", "203.0.113.7"),  # IPv4-mapped IPv6 counts as the IPv4 address
        ("not-an-address", "not-an-address"),  # unparsable: an opaque string
        ("unknown", "unknown"),
    ],
)
def test_address_key(address: str, key: str) -> None:
    assert address_key(address) == key
