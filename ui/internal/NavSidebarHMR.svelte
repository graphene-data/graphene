<script>
  import navData from 'virtual:nav'
  import NavSidebar from './NavSidebar.svelte'

  export let currentFile = ''
</script>

<NavSidebar files={navData} {currentFile} />
