import urllib.parse

# Replace with your actual username and password
username = "Prihea"
password = "Prihea@12"

encoded_username = urllib.parse.quote_plus(username)
encoded_password = urllib.parse.quote_plus(password)

print(f"Encoded username: {encoded_username}")
print(f"Encoded password: {encoded_password}")