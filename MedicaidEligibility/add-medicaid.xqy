cat > add-medicaid.xqy <<'EOF'
xquery version "1.0-ml";
declareUpdate();
xdmp:document-add-collections("/data/medicaid/292.json", "medicaid");
EOF
