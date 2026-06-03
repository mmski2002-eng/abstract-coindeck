import paramiko, sys
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('216.173.70.241', username='root', password='REDACTED')
stdin, stdout, _ = client.exec_command('cat /var/www/abstract-coindeck/data/palette.json 2>/dev/null || echo "NOT FOUND"')
out = stdout.read()
sys.stdout.buffer.write(out)
client.close()
