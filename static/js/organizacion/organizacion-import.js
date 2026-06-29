/**
 * organizacion-import.js
 * Lógica de importación/exportar Excel
 */

document.addEventListener('DOMContentLoaded', () => {

    const importOverlay   = document.getElementById('importModalOverlay');
    const dropZone        = document.getElementById('dropZone');
    const dropFileName    = document.getElementById('dropZoneFileName');
    const btnImportarExcel= document.getElementById('btnImportarExcel');
    const btnProcesar     = document.getElementById('btnProcesarImport');
    const fileInput       = document.getElementById('excelFileInput');
    let selectedFile      = null;

    const openImportModal = () => { importOverlay.classList.add('open'); resetImportModal(); };
    const closeImportModal= () => { importOverlay.classList.remove('open'); selectedFile=null; };

    const resetImportModal = () => {
        selectedFile=null; btnProcesar.disabled=true;
        dropFileName.style.display='none'; dropFileName.textContent='';
        document.getElementById('importResult').classList.remove('visible');
        document.getElementById('importErrorsList').style.display='none';
        document.getElementById('importErrorsList').innerHTML='';
        ['statOk','statSkip','statErr'].forEach(id=>{ document.getElementById(id).textContent='0'; });
    };

    btnImportarExcel?.addEventListener('click', openImportModal);
    document.getElementById('importModalClose')?.addEventListener('click', closeImportModal);
    document.getElementById('importModalCancel')?.addEventListener('click', closeImportModal);
    importOverlay?.addEventListener('click', e=>{ if(e.target===importOverlay) closeImportModal(); });

    // Drag & drop
    dropZone?.addEventListener('click', ()=>fileInput.click());
    dropZone?.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', ()=>dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e=>{ e.preventDefault(); dropZone.classList.remove('drag-over'); handleFileSelect(e.dataTransfer.files[0]); });
    fileInput?.addEventListener('change', e=>{ handleFileSelect(e.target.files[0]); e.target.value=''; });

    const handleFileSelect = file => {
        if(!file) return;
        if(!file.name.match(/\.(xlsx|xls)$/i)){ alert('Por favor selecciona un archivo Excel (.xlsx o .xls)'); return; }
        selectedFile=file;
        dropFileName.textContent=file.name;
        dropFileName.style.display='block';
        btnProcesar.disabled=false;
        document.getElementById('importResult').classList.remove('visible');
    };

    btnProcesar?.addEventListener('click', async () => {
        if(!selectedFile) return;
        btnProcesar.disabled=true;
        btnProcesar.innerHTML=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;animation:spin 1s linear infinite;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Procesando…`;
        const fd=new FormData();
        fd.append('file', selectedFile);
        try{
            const resp=await fetch('/api/organizacion/importar-excel/',{method:'POST',headers:{'X-CSRFToken':window.getCookie('csrftoken')},body:fd});
            const result=await resp.json();
            document.getElementById('statOk').textContent   = result.importados||0;
            document.getElementById('statSkip').textContent = result.omitidos||0;
            document.getElementById('statErr').textContent  = result.errores||0;
            document.getElementById('importResult').classList.add('visible');
            const errList=document.getElementById('importErrorsList');
            if(result.detalle_errores&&result.detalle_errores.length>0){
                errList.innerHTML=result.detalle_errores.map(e=>`<div class="import-error-item">${e}</div>`).join('');
                errList.style.display='block';
            } else { errList.style.display='none'; }
            if(result.importados>0) setTimeout(()=>window.location.reload(), 2500);
        }catch(err){ alert('Error al procesar el archivo.'); }
        finally{
            btnProcesar.disabled=false;
            btnProcesar.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Procesar`;
        }
    });

    // DESCARGAR MODELO EXCEL
    document.getElementById('btnDescargarModelo')?.addEventListener('click', () => {
        window.location.href='/api/organizacion/descargar-modelo/';
    });

    // EXPORTAR TODO
    document.getElementById('btnExportarExcel')?.addEventListener('click', () => {
        window.location.href='/api/organizacion/exportar-excel/';
    });

});
