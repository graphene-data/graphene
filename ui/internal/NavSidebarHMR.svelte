<script>
  import navData from 'virtual:nav'
  import NavSidebar from './NavSidebar.svelte'

  let {currentFile = ''} = $props()
</script>

<NavSidebar files={navData} {currentFile} />
